// Player and enemy bullets. Player bullets bend under gravity (visible curved
// tracers), pierce through enemies when upgraded, and record a short trail so the
// curve is drawn, not just simulated. Enemy bullets fly straight and hurt on contact.
import { bendBulletsByGravity } from './gravityWells.js';
import { killEnemy } from './enemies.js';
import { spawnSparks, addFloater } from './particles.js';
import { damagePlayer } from './player.js';
import { ARENA_W, ARENA_H } from './player.js';

const BULLET_SPEED = 640;
const BULLET_DAMAGE = 12;

/** Fire the player's spread toward (aimX, aimY); respects fire rate and multishot. */
export function firePlayerBullets(state, aimX, aimY) {
  const p = state.player;
  if (p.fireCooldown > 0) return false;
  p.fireCooldown = p.fireInterval;
  const baseAngle = Math.atan2(aimY - p.y, aimX - p.x);
  const count = 1 + p.multishot;
  const spread = 0.13;
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const a = baseAngle + offset;
    state.bullets.push({
      x: p.x + Math.cos(a) * (p.r + 8),
      y: p.y + Math.sin(a) * (p.r + 8),
      vx: Math.cos(a) * BULLET_SPEED,
      vy: Math.sin(a) * BULLET_SPEED,
      baseSpeed: BULLET_SPEED,
      r: 4, dmg: BULLET_DAMAGE, pierceLeft: p.pierce,
      life: 1.6, trail: [], hitSet: new Set(),
    });
  }
  return true;
}

/** Move player bullets, bend them, and resolve hits against enemies. */
export function updateBullets(state, dt) {
  bendBulletsByGravity(state.bullets, state.wells, dt);
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 9) b.trail.shift();
    let dead = b.life <= 0
      || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20;
    if (!dead) {
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (b.hitSet.has(e)) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          b.hitSet.add(e);
          e.hp -= b.dmg;
          e.flash = 0.12;
          spawnSparks(state, b.x, b.y, '#f5b942', 4);
          addFloater(state, e.x, e.y - e.r - 4, String(b.dmg), '#ffd97a');
          if (e.hp <= 0) {
            killEnemy(state, e, true);
            state.lastKillAt = state.time;
          }
          if (b.pierceLeft > 0) {
            b.pierceLeft -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Move enemy bullets and resolve hits against the player. */
export function updateEnemyBullets(state, dt) {
  const p = state.player;
  for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = state.enemyBullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.shift();
    let dead = b.life <= 0
      || b.x < -20 || b.x > ARENA_W + 20 || b.y < -20 || b.y > ARENA_H + 20;
    if (!dead) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const rr = p.r + b.r - 2;
      if (dx * dx + dy * dy < rr * rr) {
        if (damagePlayer(state, b.dmg)) state.lastHitAt = state.time;
        dead = true;
      }
    }
    if (dead) state.enemyBullets.splice(i, 1);
  }
}

/** Nova Bomb: wipe every enemy bullet and hammer every enemy on screen. */
export function detonateNovaBomb(state) {
  const p = state.player;
  if (p.bombs <= 0) return false;
  p.bombs -= 1;
  for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = state.enemyBullets[i];
    spawnSparks(state, b.x, b.y, '#2dd4bf', 3);
  }
  state.enemyBullets.length = 0;
  for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
    const e = state.enemies[j];
    e.hp -= 150;
    e.flash = 0.2;
    if (e.hp <= 0) killEnemy(state, e, true);
  }
  spawnRing(state, p.x, p.y, '#2dd4bf');
  spawnRing(state, p.x, p.y, '#f5b942');
  state.shake = Math.max(state.shake, 12);
  state.flashWhite = 0.22;
  return true;
}
