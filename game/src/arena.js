// The arena: one run state and its fixed-step update. Phases are 'title' (ambient
// drift), 'play', 'upgrade' (wave cleared, pick 1 of 3) and 'over'. The update wires
// player, enemies, bullets, wells, pickups and combo together and reports events.
import { createWells, updateWells } from './gravityWells.js';
import { createPlayer, updatePlayer, dashWithInvulnerability, damagePlayer, healPlayer } from './player.js';
import { spawnWave, updateEnemies } from './enemies.js';
import { firePlayerBullets, updateBullets, updateEnemyBullets, detonateNovaBomb } from './bullets.js';
import { rollUpgradeChoices, applyUpgrade } from './upgrades.js';
import { updateParticles, addFloater } from './particles.js';
import { ACTION_DASH, ACTION_BOMB } from './input.js';

export const EVENT_KILL = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_PICKUP = 16;

/** mulberry32: small deterministic rng so ?shot= scenes reproduce exactly. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createArena(seed) {
  const state = {
    rng: createRng(seed),
    seed,
    time: 0,
    phase: 'title',
    wells: createWells(),
    player: createPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    wave: 0,
    waveTotal: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    bombsUsed: 0,
    shake: 0,
    flashWhite: 0,
    lastMove: { x: 0, y: 0 },
    lastKillAt: -99,
    lastHitAt: -99,
    upgradeChoices: [],
    upgradeFlash: null,
    waveSpawnedAt: 0,
  };
  return state;
}

export function resetArena(state) {
  const fresh = createArena(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

/** Start a fresh run: reset everything and open wave 1. */
export function startRun(state) {
  resetArena(state);
  state.phase = 'play';
  state.wave = 1;
  spawnWave(state);
}

/** Open the next wave after an upgrade was picked. */
export function nextWave(state) {
  state.wave += 1;
  state.phase = 'play';
  spawnWave(state);
}

function updatePickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    pk.life -= dt;
    pk.bob += dt * 4;
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < p.magnetRadius) {
      pk.vx += (dx / dist) * 900 * dt;
      pk.vy += (dy / dist) * 900 * dt;
    } else {
      pk.vx *= Math.max(0, 1 - 2 * dt);
      pk.vy *= Math.max(0, 1 - 2 * dt);
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    if (dist < p.r + pk.r + 4) {
      if (pk.kind === 'heal') {
        healPlayer(state, pk.value);
        addFloater(state, p.x, p.y - 24, `+${pk.value} HULL`, '#34d399');
      } else {
        state.score += pk.value;
        addFloater(state, p.x, p.y - 24, `+${pk.value}`, '#f5b942');
      }
      state.pickups.splice(i, 1);
      return EVENT_PICKUP;
    }
    if (pk.life <= 0) state.pickups.splice(i, 1);
  }
  return 0;
}

function checkContactDamage(state) {
  const p = state.player;
  let events = 0;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const rr = p.r + e.r - 2;
    if (dx * dx + dy * dy < rr * rr) {
      if (damagePlayer(state, e.dmg)) {
        events |= EVENT_HIT;
        state.lastHitAt = state.time;
      }
      // Shove the enemy off so it does not sit on the player.
      const dist = Math.hypot(dx, dy) || 1;
      e.x -= (dx / dist) * 6;
      e.y -= (dy / dist) * 6;
    }
  }
  return events;
}

/** Advance the run one fixed step. Returns an event bitmask for sounds/announces. */
export function updateArena(state, input, dt, audio) {
  state.time += dt;
  updateWells(state.wells, dt, state.time);
  updateParticles(state, dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  if (state.flashWhite > 0) state.flashWhite -= dt;
  if (state.upgradeFlash) {
    state.upgradeFlash.timer -= dt;
    if (state.upgradeFlash.timer <= 0) state.upgradeFlash = null;
  }
  if (state.phase !== 'play') return 0;

  let events = 0;
  const actions = typeof input.takeGameActions === 'function'
    ? input.takeGameActions()
    : input.takeActions();
  if (actions & ACTION_DASH) {
    if (dashWithInvulnerability(state) && audio) audio.dash();
  }
  if (actions & ACTION_BOMB) {
    if (detonateNovaBomb(state)) {
      state.bombsUsed += 1;
      if (audio) audio.bomb();
    }
  }

  updatePlayer(state, input, dt);
  if (input.firing && firePlayerBullets(state, input.aim().x, input.aim().y) && audio) audio.shoot();
  updateBullets(state, dt);
  updateEnemyBullets(state, dt);
  updateEnemies(state, dt);
  events |= checkContactDamage(state);
  events |= updatePickups(state, dt);

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.phase = 'over';
    return events | EVENT_OVER;
  }

  if (state.enemies.length === 0) {
    const bonus = 100 * state.wave;
    state.score += bonus;
    addFloater(state, state.player.x, state.player.y - 30, `WAVE ${state.wave} CLEAR +${bonus}`, '#2dd4bf');
    state.upgradeChoices = rollUpgradeChoices(state.rng, state.player.upgradeLevels);
    state.phase = 'upgrade';
    if (audio) audio.waveClear();
    return events | EVENT_WAVE_CLEAR;
  }

  return events;
}

/** Pick an upgrade card (0-based) and open the next wave. */
export function chooseUpgrade(state, index, audio) {
  const choice = state.upgradeChoices[index];
  if (!choice || state.phase !== 'upgrade') return false;
  applyUpgrade(state, choice.id);
  if (audio) audio.upgrade();
  nextWave(state);
  return true;
}
