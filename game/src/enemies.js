// The five enemy kinds of Nova Drift, the wave spawner, and per-kind behaviour:
// chasers hunt, spitters shoot, splitters burst into motes, comets telegraph then dash,
// and the Bulwark boss fires radial rings every fifth wave.
import { ENEMY_COLORS } from './palette.js';
import { applyWellPull } from './gravityWells.js';
import { spawnExplosion, spawnSparks, spawnRing, addFloater } from './particles.js';
import { ARENA_W, ARENA_H } from './player.js';

export const ENEMY_TYPES = {
  shard: { hp: 20, speed: 155, r: 12, dmg: 10, score: 50 },
  spitter: { hp: 30, speed: 72, r: 14, dmg: 8, score: 80 },
  splitter: { hp: 46, speed: 95, r: 17, dmg: 10, score: 90 },
  mote: { hp: 12, speed: 118, r: 9, dmg: 6, score: 40 },
  comet: { hp: 36, speed: 92, r: 13, dmg: 14, score: 100 },
  bulwark: { hp: 620, speed: 42, r: 46, dmg: 16, score: 1000 },
};

function edgeSpawn(state) {
  const side = Math.floor(state.rng() * 4);
  const m = 30;
  if (side === 0) return { x: 40 + state.rng() * (ARENA_W - 80), y: m };
  if (side === 1) return { x: 40 + state.rng() * (ARENA_W - 80), y: ARENA_H - m };
  if (side === 2) return { x: m, y: 40 + state.rng() * (ARENA_H - 80) };
  return { x: ARENA_W - m, y: 40 + state.rng() * (ARENA_H - 80) };
}

export function spawnEnemy(state, kind, x, y) {
  const base = ENEMY_TYPES[kind];
  const hpScale = 1 + (state.wave - 1) * 0.09;
  const speedScale = 1 + Math.min(0.5, (state.wave - 1) * 0.03);
  const pos = x === undefined ? edgeSpawn(state) : { x, y };
  state.enemies.push({
    kind,
    x: pos.x, y: pos.y, vx: 0, vy: 0,
    r: base.r,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed * speedScale,
    dmg: base.dmg,
    score: base.score,
    color: ENEMY_COLORS[kind],
    shootTimer: 1.2 + state.rng() * 1.4,
    telegraph: 0, dashTimer: 0, dashVx: 0, dashVy: 0,
    radialTimer: 2,
    flash: 0, wobble: state.rng() * Math.PI * 2,
  });
}

/** Split a dead splitter into two small motes that scatter outward. */
export function spawnMotes(state, x, y) {
  for (let i = 0; i < 2; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const mote = {
      kind: 'mote',
      x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18,
      vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130,
      r: ENEMY_TYPES.mote.r,
      hp: ENEMY_TYPES.mote.hp, maxHp: ENEMY_TYPES.mote.hp,
      speed: ENEMY_TYPES.mote.speed, dmg: ENEMY_TYPES.mote.dmg,
      score: ENEMY_TYPES.mote.score, color: ENEMY_COLORS.mote,
      shootTimer: 0, telegraph: 0, dashTimer: 0, dashVx: 0, dashVy: 0,
      radialTimer: 0, flash: 0, wobble: state.rng() * Math.PI * 2,
    };
    state.enemies.push(mote);
  }
}

/** Build one wave: more, faster and tougher enemies each wave, boss every 5th. */
export function spawnWave(state) {
  const wave = state.wave;
  const isBoss = wave % 5 === 0;
  let count = 5 + wave * 2;
  if (isBoss) {
    spawnEnemy(state, 'bulwark');
    count = 2 + wave;
  }
  for (let i = 0; i < count; i += 1) {
    const roll = state.rng();
    let kind = 'shard';
    if (wave >= 2 && roll < 0.24) kind = 'spitter';
    else if (wave >= 3 && roll < 0.42) kind = 'splitter';
    else if (wave >= 4 && roll < 0.58) kind = 'comet';
    else if (wave >= 2 && roll < 0.68) kind = 'spitter';
    spawnEnemy(state, kind);
  }
  state.waveTotal = state.enemies.length;
  state.waveSpawnedAt = state.time;
}

/** Award score with the combo multiplier, drop a pickup, burst into motes if a splitter. */
export function killEnemy(state, enemy, award) {
  const index = state.enemies.indexOf(enemy);
  if (index !== -1) state.enemies.splice(index, 1);
  spawnExplosion(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'bulwark' ? 60 : 22, enemy.kind === 'bulwark' ? 1.8 : 1);
  spawnRing(state, enemy.x, enemy.y, enemy.color);
  state.shake = Math.max(state.shake, enemy.kind === 'bulwark' ? 14 : 4);
  if (enemy.kind === 'splitter') spawnMotes(state, enemy.x, enemy.y);
  if (!award) return;
  state.kills += 1;
  state.combo = Math.min(state.combo + 1, 12);
  state.comboTimer = 2;
  const mult = Math.min(state.combo, 8);
  const gained = enemy.score * mult;
  state.score += gained;
  addFloater(state, enemy.x, enemy.y - 10, `+${gained}`, mult >= 4 ? '#f5b942' : '#f5edd8');
  if (state.rng() < 0.26) {
    const heal = state.rng() < 0.35;
    state.pickups.push({
      x: enemy.x, y: enemy.y, vx: 0, vy: 0,
      kind: heal ? 'heal' : 'gem',
      value: heal ? 10 : 50,
      r: 9, life: 9, bob: state.rng() * Math.PI * 2,
    });
  }
  if (enemy.kind === 'bulwark') {
    state.score += 500;
    addFloater(state, enemy.x, enemy.y - 40, 'BOSS DOWN +500', '#f5b942');
  }
}

/** Per-kind movement and attacks for one fixed step. */
export function updateEnemies(state, dt) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    if (e.flash > 0) e.flash -= dt;
    e.wobble += dt * 3;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.kind === 'comet') {
      if (e.dashTimer > 0) {
        e.dashTimer -= dt;
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
        spawnSparks(state, e.x, e.y, '#fb923c', 1);
      } else if (e.telegraph > 0) {
        e.telegraph -= dt;
        e.flash = 0.1;
        if (e.telegraph <= 0) {
          e.dashVx = nx * 540;
          e.dashVy = ny * 540;
          e.dashTimer = 0.5;
          e.shootTimer = 2.2 + state.rng();
        }
      } else {
        e.shootTimer -= dt;
        e.vx += nx * e.speed * 2.4 * dt;
        e.vy += ny * e.speed * 2.4 * dt;
        if (dist < 260 && e.shootTimer <= 0) e.telegraph = 0.6;
      }
    } else if (e.kind === 'spitter') {
      e.shootTimer -= dt;
      const want = 300;
      const toward = dist > want ? 1 : dist < want - 60 ? -1 : 0;
      e.vx += nx * e.speed * toward * 2.4 * dt;
      e.vy += ny * e.speed * toward * 2.4 * dt;
      if (e.shootTimer <= 0 && dist < 560) {
        e.shootTimer = 2.1 + state.rng() * 0.7;
        state.enemyBullets.push({
          x: e.x, y: e.y, vx: nx * 175, vy: ny * 175,
          baseSpeed: 175, r: 6, dmg: e.dmg, life: 6, trail: [],
        });
        spawnSparks(state, e.x, e.y, '#c084fc', 4);
      }
    } else if (e.kind === 'bulwark') {
      e.radialTimer -= dt;
      e.vx += nx * e.speed * 2.4 * dt;
      e.vy += ny * e.speed * 2.4 * dt;
      if (e.radialTimer <= 0) {
        e.radialTimer = 2.4;
        const n = 12;
        for (let k = 0; k < n; k += 1) {
          const a = (k / n) * Math.PI * 2 + state.time * 0.4;
          state.enemyBullets.push({
            x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
            baseSpeed: 150, r: 6, dmg: e.dmg, life: 7, trail: [],
          });
        }
        spawnRing(state, e.x, e.y, '#eab308');
        state.shake = Math.max(state.shake, 6);
      }
    } else {
      // Shard, splitter and mote: steer at the player with a slight wobble.
      const wob = Math.sin(e.wobble) * 0.35;
      const ax = nx + -ny * wob;
      const ay = ny + nx * wob;
      e.vx += ax * e.speed * 2.4 * dt;
      e.vy += ay * e.speed * 2.4 * dt;
    }

    applyWellPull(e, state.wells, dt, false);
    const drag = Math.max(0, 1 - 1.6 * dt);
    e.vx *= drag;
    e.vy *= drag;
    const spd = Math.hypot(e.vx, e.vy);
    const maxSpd = e.dashTimer > 0 ? 560 : e.speed * 1.35;
    if (spd > maxSpd) {
      e.vx = (e.vx / spd) * maxSpd;
      e.vy = (e.vy / spd) * maxSpd;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < e.r) { e.x = e.r; e.vx = Math.abs(e.vx) * 0.5; }
    if (e.x > ARENA_W - e.r) { e.x = ARENA_W - e.r; e.vx = -Math.abs(e.vx) * 0.5; }
    if (e.y < e.r) { e.y = e.r; e.vy = Math.abs(e.vy) * 0.5; }
    if (e.y > ARENA_H - e.r) { e.y = ARENA_H - e.r; e.vy = -Math.abs(e.vy) * 0.5; }
  }
}
