// Nova Drift boot and main loop. Fixed 1/60 s steps, four screens (title, play,
// upgrade, paused, game over), and deterministic ?shot= scenes for screenshots:
//   ?shot=title   — title screen over a drifting arena
//   ?shot=play    — mid-wave-2 action, the cover frame
//   ?shot=upgrade — the pick-1-of-3 upgrade screen after wave 1
//   ?shot=end     — game-over results after a reckless run
// Each shot simulates the real rules forward from a fresh seeded run, paints twice,
// then sets window.__shotReady.
import { createRng, createArena, resetArena, startRun, updateArena, chooseUpgrade, EVENT_OVER, EVENT_HIT, EVENT_WAVE_CLEAR, EVENT_PICKUP } from './arena.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH, ACTION_MUTE, ACTION_RESTART } from './input.js';
import { createAudio } from './audio.js';
import { drawParticles } from './particles.js';
import { drawHUD, drawTitleScreen, drawUpgradeScreen, drawGameOverScreen, drawPausedScreen, upgradeCardAt } from './hud.js';
import { PALETTE } from './palette.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const BEST_KEY = 'nova-drift-best';
const SHOT_SEED = 20261117;
const ARENA_W = 1280;
const ARENA_H = 720;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.random() * 4294967296) | 0;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const state = createArena(seed);
const audio = createAudio();

// Seeded starfield so the background never flickers between frames.
const stars = [];
{
  const rng = createRng(99);
  for (let i = 0; i < 150; i += 1) {
    stars.push({ x: rng() * ARENA_W, y: rng() * ARENA_H, r: 0.5 + rng() * 1.6, phase: rng() * Math.PI * 2 });
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage off (private windows): the best score lasts this visit only.
  }
}

// ---------- world rendering ----------

function drawBackground(time) {
  const grad = ctx.createRadialGradient(640, 360, 80, 640, 360, 780);
  grad.addColorStop(0, PALETTE.nebulaA);
  grad.addColorStop(0.55, PALETTE.bg);
  grad.addColorStop(1, PALETTE.bgDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  for (let i = 0; i < stars.length; i += 1) {
    const s = stars[i];
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.5 + s.phase);
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawWells(time) {
  for (let i = 0; i < state.wells.length; i += 1) {
    const well = state.wells[i];
    const spin = time * (well.kind === 'anomaly' ? 1.6 : 0.9);
    const glow = ctx.createRadialGradient(well.x, well.y, 4, well.x, well.y, 110);
    glow.addColorStop(0, well.kind === 'anomaly' ? 'rgba(45,212,191,0.5)' : 'rgba(245,185,66,0.5)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(well.x, well.y, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = well.color;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.globalAlpha = 0.85 - ring * 0.22;
      ctx.lineWidth = ring === 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(well.x, well.y, well.radius + ring * 14, spin + ring, spin + ring + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#04051a';
    ctx.beginPath();
    ctx.arc(well.x, well.y, well.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = well.color;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(well.kind === 'anomaly' ? 'ANOMALY' : 'GRAVITY WELL', well.x, well.y + well.radius + 26);
  }
}

function drawPlayer(time) {
  const p = state.player;
  if (state.phase === 'over') return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  // Engine flame, longer while dashing.
  const thrust = p.dashTime > 0 ? 26 : 12 + Math.sin(time * 30) * 3;
  ctx.rotate(p.angle);
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.moveTo(-p.r - 2, 5);
  ctx.lineTo(-p.r - thrust, 0);
  ctx.lineTo(-p.r - 2, -5);
  ctx.closePath();
  ctx.fill();
  // Hull: a gold dart with a teal cockpit.
  ctx.fillStyle = p.flash > 0 ? '#ffffff' : PALETTE.gold;
  ctx.shadowColor = 'rgba(245,185,66,0.8)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(p.r + 6, 0);
  ctx.lineTo(-p.r, 10);
  ctx.lineTo(-p.r + 5, 0);
  ctx.lineTo(-p.r, -10);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.teal;
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemies(time) {
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalAlpha = 1;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
    if (e.kind === 'shard') {
      ctx.rotate(time * 2 + e.wobble);
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.rotate(Math.atan2(state.player.y - e.y, state.player.x - e.x));
      ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2);
      ctx.fillStyle = '#2a1a4a';
      ctx.fillRect(0, -3, e.r + 8, 6);
    } else if (e.kind === 'splitter') {
      ctx.rotate(e.wobble * 0.4);
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3d0a2e';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'mote') {
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'comet') {
      const blink = e.telegraph > 0 && Math.floor(time * 16) % 2 === 0;
      ctx.globalAlpha = blink ? 0.35 : 1;
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.beginPath();
      ctx.moveTo(e.r + 6, 0);
      ctx.lineTo(-e.r, e.r * 0.8);
      ctx.lineTo(-e.r * 0.5, 0);
      ctx.lineTo(-e.r, -e.r * 0.8);
      ctx.closePath();
      ctx.fill();
      if (e.telegraph > 0) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === 'bulwark') {
      ctx.rotate(time * 0.4);
      ctx.beginPath();
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-time * 0.4);
      ctx.fillStyle = '#1c1445';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health pip for anything tougher than a shard.
    if (e.maxHp > 25 && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(5,7,26,0.8)';
      ctx.fillRect(e.x - 18, e.y - e.r - 12, 36, 5);
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(e.x - 18, e.y - e.r - 12, 36 * Math.max(0, e.hp / e.maxHp), 5);
    }
  }
}

function drawBullets() {
  for (let i = 0; i < state.bullets.length; i += 1) {
    const b = state.bullets[i];
    ctx.strokeStyle = 'rgba(245,185,66,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t < b.trail.length; t += 1) {
      if (t === 0) ctx.moveTo(b.trail[t].x, b.trail[t].y);
      else ctx.lineTo(b.trail[t].x, b.trail[t].y);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.shadowColor = 'rgba(245,185,66,0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  for (let i = 0; i < state.enemyBullets.length; i += 1) {
    const b = state.enemyBullets[i];
    ctx.fillStyle = '#e879f9';
    ctx.shadowColor = 'rgba(232,121,249,0.9)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPickups(time) {
  for (let i = 0; i < state.pickups.length; i += 1) {
    const pk = state.pickups[i];
    const bobY = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bobY);
    ctx.globalAlpha = Math.min(1, pk.life);
    if (pk.kind === 'heal') {
      ctx.fillStyle = '#34d399';
      ctx.shadowColor = 'rgba(52,211,153,0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, pk.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#04051a';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = PALETTE.teal;
      ctx.shadowColor = 'rgba(45,212,191,0.8)';
      ctx.shadowBlur = 10;
      ctx.rotate(time * 2);
      ctx.fillRect(-6, -6, 12, 12);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawWorld(screen, time) {
  ctx.save();
  if (state.shake > 0.5) {
    ctx.translate((state.rng() - 0.5) * state.shake, (state.rng() - 0.5) * state.shake);
  }
  drawBackground(time);
  drawWells(time);
  drawPickups(time);
  drawEnemies(time);
  drawBullets();
  drawPlayer(time);
  drawParticles(ctx, state);
  ctx.restore();
  if (state.flashWhite > 0) {
    ctx.fillStyle = `rgba(245,237,216,${Math.min(0.5, state.flashWhite)})`;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  }
  if (screen === 'play' || screen === 'upgrade' || screen === 'paused') drawHUD(ctx, state, best);
  if (screen === 'title') drawTitleScreen(ctx, best, time);
  if (screen === 'upgrade') drawUpgradeScreen(ctx, state);
  if (screen === 'over') drawGameOverScreen(ctx, state, best);
  if (screen === 'paused') drawPausedScreen(ctx);
}

// ---------- deterministic shot scenes ----------

/** A synthetic input that plays the real rules: chase, keep range, fire, dash clear. */
function autopilotInput(reckless) {
  return {
    direction() {
      const p = state.player;
      let target = null;
      let nearest = Infinity;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearest) {
          nearest = d;
          target = e;
        }
      }
      if (!target) return { x: 0, y: 0 };
      let dx = target.x - p.x;
      let dy = target.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist;
      dy /= dist;
      if (!reckless) {
        if (nearest < 170) {
          dx = -dx;
          dy = -dy;
        } else if (nearest < 260) {
          const px = -dy;
          const py = dx;
          dx = px;
          dy = py;
        }
        // Steer away from a well that is too close.
        for (let i = 0; i < state.wells.length; i += 1) {
          const w = state.wells[i];
          const wd = Math.hypot(w.x - p.x, w.y - p.y);
          if (wd < 130) {
            dx += (p.x - w.x) / wd;
            dy += (p.y - w.y) / wd;
          }
        }
      }
      const mag = Math.hypot(dx, dy) || 1;
      return { x: dx / mag, y: dy / mag };
    },
    aim() {
      const p = state.player;
      let target = null;
      let nearest = Infinity;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearest) {
          nearest = d;
          target = e;
        }
      }
      if (!target) return { x: p.x + 100, y: p.y };
      const flight = nearest / 640;
      return { x: target.x + target.vx * flight, y: target.y + target.vy * flight };
    },
    get firing() {
      return state.enemies.length > 0;
    },
    takeActions() {
      if (reckless) return 0;
      const p = state.player;
      for (let i = 0; i < state.enemies.length; i += 1) {
        const e = state.enemies[i];
        if (Math.hypot(e.x - p.x, e.y - p.y) < 85 && p.dashCooldown <= 0) return ACTION_DASH;
      }
      return 0;
    },
    takeDigit() {
      return 0;
    },
  };
}

/** Simulate the real rules forward until the named scene is on screen. */
function stageShot(name) {
  resetArena(state);
  state.seed = SHOT_SEED;
  state.rng = createRng(SHOT_SEED);
  if (name === 'title') {
    for (let i = 0; i < 4 / STEP; i += 1) updateArena(state, autopilotInput(false), STEP, null);
    return 'title';
  }
  startRun(state);
  const pilot = autopilotInput(name === 'end');
  if (name === 'upgrade') {
    for (let i = 0; i < 150 / STEP; i += 1) {
      updateArena(state, pilot, STEP, null);
      if (state.phase === 'upgrade') return 'upgrade';
    }
    state.enemies.length = 0;
    updateArena(state, pilot, STEP, null);
    return 'upgrade';
  }
  if (name === 'end') {
    for (let i = 0; i < 300 / STEP; i += 1) {
      updateArena(state, pilot, STEP, null);
      if (state.phase === 'over') return 'over';
    }
    state.player.hp = 0;
    updateArena(state, pilot, STEP, null);
    return 'over';
  }
  // play: push into wave 2 and stop mid-fight, bullets flying.
  for (let i = 0; i < 40 / STEP; i += 1) {
    if (state.phase === 'upgrade') chooseUpgrade(state, 0, null);
    updateArena(state, pilot, STEP, null);
    if (state.wave >= 2 && state.time - state.waveSpawnedAt > 6 && state.enemies.length >= 5) break;
    if (state.phase === 'over') break;
  }
  return state.phase === 'over' ? 'over' : 'play';
}

let best = readBest();

// ---------- live game ----------

function runShot(screen) {
  let painted = 0;
  function paint() {
    drawWorld(screen, state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  window.__novaDrift.getScreen = () => screen;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    audio.startMusic();
    startRun(state);
    accumulator = 0;
    screen = 'play';
    announce('Playing. Clear the wave, then pick an upgrade.');
  }

  function endGame() {
    screen = 'over';
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
    audio.stopMusic();
    announce(`Game over. Score ${state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.ensure();
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === 'play' || screen === 'over' || screen === 'paused' || screen === 'upgrade')) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === 'title') startGame();
    else if (actions & ACTION_CONFIRM && screen === 'over') startGame();
    else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play';
      announce('Playing.');
    }
  }

  function step() {
    if (screen === 'title') {
      updateArena(state, input, STEP, null);
      return;
    }
    if (screen === 'upgrade') {
      const digit = input.takeDigit();
      if (digit >= 1 && digit <= 3) {
        if (chooseUpgrade(state, digit - 1, audio)) screen = 'play';
      }
      updateArena(state, input, STEP, null);
      return;
    }
    const events = updateArena(state, input, STEP, audio);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_WAVE_CLEAR) screen = 'upgrade';
    else if (events & EVENT_HIT) announce(`Hit. Hull ${Math.max(0, Math.ceil(state.player.hp))}.`);
    else if (events & EVENT_PICKUP) audio.pickup();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'title' || screen === 'play' || screen === 'upgrade') {
      while (accumulator >= STEP && (screen === 'title' || screen === 'play' || screen === 'upgrade')) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    drawWorld(screen, state.time);
  }

  canvas.addEventListener('mousedown', (event) => {
    if (screen !== 'upgrade') return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const index = upgradeCardAt(x, y);
    if (index >= 0 && chooseUpgrade(state, index, audio)) screen = 'play';
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Nova Drift. Press Space or click to start.');
  requestAnimationFrame(frame);
}

// Handles for the playtest tool: read-only inspection, no cheating.
window.__novaDrift = {
  getState: () => state,
  getBest: () => best,
  getScreen: () => window.__shotScreen || null,
};

if (shot) {
  const screen = stageShot(shot);
  window.__shotScreen = screen;
  runShot(screen);
} else {
  runGame();
}
