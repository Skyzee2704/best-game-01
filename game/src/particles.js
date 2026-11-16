// Particles, explosion sparks and floating damage numbers. Purely cosmetic: they are
// spawned on kills, hits, pickups and dashes, and fade out over their short life.
export function spawnExplosion(state, x, y, color, count, power) {
  const n = count || 22;
  const p = power || 1;
  for (let i = 0; i < n; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const speed = (60 + state.rng() * 260) * p;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + state.rng() * 0.45,
      maxLife: 0.8,
      size: 2 + state.rng() * 3.5,
      color,
      drag: 2.2,
    });
  }
}

export function spawnSparks(state, x, y, color, count) {
  const n = count || 6;
  for (let i = 0; i < n; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const speed = 40 + state.rng() * 140;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.2 + state.rng() * 0.25,
      maxLife: 0.45,
      size: 1.5 + state.rng() * 2,
      color,
      drag: 3,
    });
  }
}

export function spawnRing(state, x, y, color) {
  state.particles.push({
    x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45,
    size: 8, color, drag: 0, ring: true,
  });
}

/** Floating combat text: damage numbers, score pops and upgrade callouts. */
export function addFloater(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color: color || '#f5edd8', life: 0.9, maxLife: 0.9 });
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.ring) p.size += 260 * dt;
  }
  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const f = state.floaters[i];
    f.life -= dt;
    f.y -= 42 * dt;
    if (f.life <= 0) state.floaters.splice(i, 1);
  }
}

export function drawParticles(ctx, state) {
  for (let i = 0; i < state.particles.length; i += 1) {
    const p = state.particles[i];
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (let i = 0; i < state.floaters.length; i += 1) {
    const f = state.floaters[i];
    const alpha = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
