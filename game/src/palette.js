// Nova Drift palette: gold and amber fire on deep indigo, teal as the second accent.
// Every colour the game draws comes from here so the look stays consistent.
export const PALETTE = {
  bg: '#070a1e',
  bgDeep: '#04051a',
  nebulaA: '#131a45',
  nebulaB: '#1c1445',
  gold: '#f5b942',
  amber: '#ff8c1a',
  ember: '#ff5d3a',
  teal: '#2dd4bf',
  tealDim: '#0f766e',
  cream: '#f5edd8',
  dim: '#8b93b8',
  red: '#ff4d6d',
  hpGood: '#34d399',
  hpLow: '#ff4d6d',
  shield: '#7dd3fc',
  wellFixed: '#f5b942',
  wellAnomaly: '#2dd4bf',
  cardBg: '#141a3d',
  cardEdge: '#f5b942',
};

export const ENEMY_COLORS = {
  shard: '#ff6b6b',
  spitter: '#c084fc',
  splitter: '#f472b6',
  mote: '#fda4af',
  comet: '#fb923c',
  bulwark: '#eab308',
};

export const ENEMY_GLOW = {
  shard: 'rgba(255,107,107,0.55)',
  spitter: 'rgba(192,132,252,0.55)',
  splitter: 'rgba(244,114,182,0.55)',
  mote: 'rgba(253,164,175,0.55)',
  comet: 'rgba(251,146,60,0.6)',
  bulwark: 'rgba(234,179,8,0.6)',
};

/** Pick a deterministic colour from an array with the seeded rng. */
export function pickColor(rng, colors) {
  return colors[Math.floor(rng() * colors.length)];
}
