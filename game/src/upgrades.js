// The upgrade pool: 8 upgrades, 3 offered after every cleared wave, pick 1.
// Levels stack; each upgrade knows its own cap so offers stay meaningful.
export const UPGRADES = [
  { id: 'multishot', name: 'Multishot', icon: '✦✦', max: 3, desc: '+1 projectile per shot. Fill the sky with curved fire.' },
  { id: 'pierce', name: 'Pierce', icon: '➶', max: 3, desc: 'Bullets punch through +1 enemy. One shot, a whole line.' },
  { id: 'rapid', name: 'Rapid Fire', icon: '≫', max: 4, desc: '+18% fire rate. Hold the trigger down and never let go.' },
  { id: 'magnet', name: 'Magnet', icon: '🧲', max: 3, desc: '+70 pickup radius. Gems and heals fly to you.' },
  { id: 'plating', name: 'Hull Plating', icon: '⬢', max: 4, desc: '+25 max hull and repair 25 hull right now.' },
  { id: 'dash', name: 'Dash Recharge', icon: '↯', max: 3, desc: 'Dash cools down 25% faster. Blink through danger.' },
  { id: 'bomb', name: 'Nova Bomb', icon: '✺', max: 3, desc: '+1 Nova Bomb. E or right-click: clear the screen.' },
  { id: 'anchor', name: 'Gravity Anchor', icon: '⚓', max: 1, desc: 'Immune to gravity wells. Your course is your own.' },
];

/** Roll 3 distinct upgrades the player has not maxed out yet. */
export function rollUpgradeChoices(rng, levels) {
  const available = UPGRADES.filter((u) => (levels[u.id] || 0) < u.max);
  const pool = available.length >= 3 ? available : UPGRADES;
  const copy = pool.slice();
  const choices = [];
  while (choices.length < 3 && copy.length > 0) {
    const index = Math.floor(rng() * copy.length);
    choices.push(copy.splice(index, 1)[0]);
  }
  return choices;
}

/** Apply one upgrade to the run state and announce it on screen. */
export function applyUpgrade(state, id) {
  const player = state.player;
  const levels = player.upgradeLevels;
  levels[id] = (levels[id] || 0) + 1;
  const level = levels[id];
  if (id === 'multishot') player.multishot = level;
  if (id === 'pierce') player.pierce = level;
  if (id === 'rapid') player.fireInterval = Math.max(0.08, 0.22 * Math.pow(0.82, level));
  if (id === 'magnet') player.magnetRadius = 90 + 70 * level;
  if (id === 'plating') {
    player.maxHp += 25;
    player.hp = Math.min(player.maxHp, player.hp + 25);
  }
  if (id === 'dash') player.dashCooldownMax = Math.max(0.9, 2.5 * Math.pow(0.75, level));
  if (id === 'bomb') player.bombs = Math.min(5, player.bombs + 1);
  if (id === 'anchor') player.anchored = true;
  const def = UPGRADES.find((u) => u.id === id);
  state.upgradeFlash = { name: def.name, level, timer: 1.6 };
  return def;
}
