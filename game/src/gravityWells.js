// Gravity wells — the twist of Nova Drift. Two fixed wells sit in the arena and one
// anomaly drifts on a slow lissajous path. Everything with velocity (ship, enemies,
// bullets) feels their pull; bullets bend visibly because they are light and fast.
// The Gravity Anchor upgrade makes the ship immune to the pull.
import { PALETTE } from './palette.js';

export function createWells() {
  return [
    { x: 330, y: 210, strength: 52000, radius: 26, kind: 'fixed', color: PALETTE.wellFixed, phase: 0 },
    { x: 950, y: 510, strength: 52000, radius: 26, kind: 'fixed', color: PALETTE.wellFixed, phase: 0 },
    { x: 640, y: 360, strength: 38000, radius: 20, kind: 'anomaly', color: PALETTE.wellAnomaly, phase: 0 },
  ];
}

/** Drift the anomaly; fixed wells never move. */
export function updateWells(wells, dt, time) {
  const anomaly = wells[2];
  anomaly.phase += dt;
  anomaly.x = 640 + Math.sin(anomaly.phase * 0.21) * 300;
  anomaly.y = 360 + Math.sin(anomaly.phase * 0.34 + 1.3) * 190;
  void time;
}

/** Acceleration felt at (x, y) from all wells, capped so nothing slingshots to infinity. */
export function gravityAt(wells, x, y) {
  let ax = 0;
  let ay = 0;
  for (let i = 0; i < wells.length; i += 1) {
    const well = wells[i];
    const dx = well.x - x;
    const dy = well.y - y;
    const distSq = dx * dx + dy * dy + 5200;
    const dist = Math.sqrt(distSq);
    const pull = well.strength / distSq;
    ax += (dx / dist) * pull;
    ay += (dy / dist) * pull;
  }
  const mag = Math.hypot(ax, ay);
  const cap = 300;
  if (mag > cap) {
    ax = (ax / mag) * cap;
    ay = (ay / mag) * cap;
  }
  return { ax, ay };
}

/** Pull a moving entity (ship or enemy) toward the wells, unless it is immune. */
export function applyWellPull(entity, wells, dt, immune) {
  if (immune) return;
  const g = gravityAt(wells, entity.x, entity.y);
  entity.vx += g.ax * dt;
  entity.vy += g.ay * dt;
}

/** Bend bullets: same gravity, stronger, so their curved tracers are easy to see. */
export function bendBulletsByGravity(bullets, wells, dt) {
  for (let i = 0; i < bullets.length; i += 1) {
    const b = bullets[i];
    const g = gravityAt(wells, b.x, b.y);
    b.vx += g.ax * 1.9 * dt;
    b.vy += g.ay * 1.9 * dt;
    // Keep bullet speed roughly constant so bending curves the path, not the pace.
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0.01) {
      const target = b.baseSpeed || speed;
      b.vx = (b.vx / speed) * target;
      b.vy = (b.vy / speed) * target;
    }
  }
}
