// The player's ship: a gold dart that flies with WASD, aims with the mouse, dashes
// with brief invulnerability, and drops Nova Bombs. All run state lives on the ship
// so upgrades mutate one object.
import { applyWellPull } from './gravityWells.js';
import { spawnSparks } from './particles.js';

export const ARENA_W = 1280;
export const ARENA_H = 720;

export function createPlayer() {
  return {
    x: 640, y: 360, vx: 0, vy: 0, r: 14,
    angle: -Math.PI / 2,
    hp: 100, maxHp: 100,
    speed: 265,
    fireCooldown: 0, fireInterval: 0.22,
    dashCooldown: 0, dashCooldownMax: 2.5, dashTime: 0,
    invuln: 0, hitCooldown: 0,
    multishot: 0, pierce: 0, magnetRadius: 90,
    bombs: 1, anchored: false,
    upgradeLevels: {},
    flash: 0,
  };
}

/** Dash: a burst of speed with a short invulnerability window, then a cooldown. */
export function dashWithInvulnerability(state) {
  const p = state.player;
  if (p.dashCooldown > 0 || p.dashTime > 0) return false;
  const dir = state.lastMove;
  const dx = dir.x !== 0 || dir.y !== 0 ? dir.x : Math.cos(p.angle);
  const dy = dir.x !== 0 || dir.y !== 0 ? dir.y : Math.sin(p.angle);
  const mag = Math.hypot(dx, dy) || 1;
  p.vx = (dx / mag) * 720;
  p.vy = (dy / mag) * 720;
  p.dashTime = 0.16;
  p.invuln = Math.max(p.invuln, 0.28);
  p.dashCooldown = p.dashCooldownMax;
  spawnSparks(state, p.x, p.y, '#7dd3fc', 10);
  state.shake = Math.max(state.shake, 3);
  return true;
}

/** Move, aim, dash and tick cooldowns. Firing itself lives in bullets.js. */
export function updatePlayer(state, input, dt) {
  const p = state.player;
  const dir = input.direction();
  state.lastMove = dir;
  const accel = 2400;
  p.vx += dir.x * accel * dt;
  p.vy += dir.y * accel * dt;
  applyWellPull(p, state.wells, dt, p.anchored);
  // Soft drag so the ship stops when the keys lift, and a hard speed cap.
  const drag = Math.max(0, 1 - 3.2 * dt);
  p.vx *= drag;
  p.vy *= drag;
  const speed = Math.hypot(p.vx, p.vy);
  const cap = p.dashTime > 0 ? 760 : p.speed;
  if (speed > cap) {
    p.vx = (p.vx / speed) * cap;
    p.vy = (p.vy / speed) * cap;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  // Clamp inside the arena with a soft bounce.
  if (p.x < p.r + 6) { p.x = p.r + 6; p.vx = Math.abs(p.vx) * 0.4; }
  if (p.x > ARENA_W - p.r - 6) { p.x = ARENA_W - p.r - 6; p.vx = -Math.abs(p.vx) * 0.4; }
  if (p.y < p.r + 6) { p.y = p.r + 6; p.vy = Math.abs(p.vy) * 0.4; }
  if (p.y > ARENA_H - p.r - 6) { p.y = ARENA_H - p.r - 6; p.vy = -Math.abs(p.vy) * 0.4; }
  const aim = input.aim();
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  if (p.dashTime > 0) p.dashTime -= dt;
  if (p.dashCooldown > 0) p.dashCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.hitCooldown > 0) p.hitCooldown -= dt;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.flash > 0) p.flash -= dt;
}

/** Damage the ship; returns false while invulnerable or on hit cooldown. */
export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0 || p.hitCooldown > 0) return false;
  p.hp -= amount;
  p.hitCooldown = 0.7;
  p.invuln = Math.max(p.invuln, 0.35);
  p.flash = 0.25;
  state.shake = Math.max(state.shake, 7);
  spawnSparks(state, p.x, p.y, '#ff4d6d', 12);
  return true;
}

export function healPlayer(state, amount) {
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}
