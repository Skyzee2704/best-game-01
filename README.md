# Nova Drift — Gravity Arena

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Skyzee2704/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Skyzee2704/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A twin-stick arena roguelite for **best-game-01** ($1,000). Pure Canvas 2D, no
libraries, no external assets, no network. Every sound is synthesised with
WebAudio; every pixel is drawn in code.

## The twist: gravity wells

Two fixed gravity wells and one drifting anomaly bend everything in the arena.
Your bullets curve visibly around them (watch the gold tracers), your ship and
the enemies are pulled off-course, and a well-timed shot can slingshot around a
well into an enemy you were never aiming at. The **Gravity Anchor** upgrade
makes your ship immune to the pull.

## Core loop

1. **WASD** to fly, **mouse** to aim, **hold click** to fire.
2. Enemies pour in from the edges. Clear the whole wave…
3. …pick **1 of 3 upgrades**, then the next wave comes harder: more enemies,
   faster, tougher.
4. A **Bulwark boss** guards every 5th wave — big, slow, firing radial rings.
5. Hull hits zero and the run ends: results screen, best score, fly again.

## Enemies (5)

| Enemy | Behaviour |
|---|---|
| **Shard** | Fast chaser, weak. The swarm. |
| **Spitter** | Keeps its distance, fires slow orbs. |
| **Splitter** | Dies into 2 small Motes. |
| **Comet** | Flashes a telegraph, then dashes straight at you. |
| **Bulwark** | Boss every 5th wave. Huge, slow, radial bullet rings. |

## Upgrades (8, pick 1 of 3 after each wave)

Multishot (+1 projectile) · Pierce (bullets pass through +1 enemy) · Rapid
Fire (+18% fire rate) · Magnet (+70 pickup radius) · Hull Plating (+25 max
hull, repair 25) · Dash Recharge (25% faster dash cooldown) · Nova Bomb (+1
screen-clearing bomb) · Gravity Anchor (immune to wells).

## Mechanics

- **Dash** (Space/Shift): burst of speed with brief invulnerability, cooldown.
- **Combo**: kills within 2 seconds raise the score multiplier (up to x8).
- **Pickups**: enemies drop score gems (+50) and hull repairs (+10); Magnet
  pulls them in.
- **Nova Bomb** (E / right-click): wipes all enemy bullets, 150 damage to
  everything on screen.
- **Score** = kills × combo + wave-clear bonus. Best score in localStorage.
- **Feel**: explosion particles, screen shake, hit flash, floating damage
  numbers, low-hull vignette, procedural music + SFX (M mutes).
- **Pause** Esc/P, **restart** R, **mute** M. Title screen shows controls and
  best score. HUD shows hull, wave, score, combo, dash cooldown, bombs and
  owned upgrades; readable at 1280×720 and when scaled down.

## Deterministic screenshots

`?shot=` stages a real scene from a fixed seed — the same seed always gives
the same frame:

- `?shot=title` — title screen
- `?shot=play` — mid-wave-2 action (the cover)
- `?shot=upgrade` — the pick-1-of-3 screen after wave 1
- `?shot=end` — game-over results

`window.__shotReady` is set once the scene has painted twice.

## Architecture

```
game/
  index.html            1280×720 canvas, loads src/main.js
  src/
    main.js             boot, fixed-step loop, screens, ?shot= staging, world rendering
    arena.js            run state, fixed-step update, wave flow, combo, pickups
    player.js           ship movement, dashWithInvulnerability, damage/heal
    enemies.js          5 kinds, spawnWave, splitter -> motes, boss radial fire
    bullets.js          firePlayerBullets, curved tracers, pierce, nova bomb
    gravityWells.js     wells, gravityAt, applyWellPull, bendBulletsByGravity
    upgrades.js         the 8-upgrade pool, rollUpgradeChoices, applyUpgrade
    particles.js        explosions, sparks, rings, floating damage numbers
    audio.js            procedural WebAudio SFX + music loop
    hud.js              HUD, title, upgrade cards, pause, game over
    input.js            keyboard + mouse, edge-triggered actions
    palette.js          gold/amber + teal on deep indigo
```

One module, one job; functions are named for what they do
(`bendBulletsByGravity`, `spawnWave`, `applyUpgrade`,
`dashWithInvulnerability`). The simulation is a seeded fixed-step loop, so a
given seed replays identically.

## How to play

```sh
node serve.ts
# open http://localhost:8080
```

## How to build / test

```sh
# screenshots (4 JPG, 1280×720, each ≤ 256 KiB)
node tools/shoot.mjs

# 12-check playtest (title -> start -> wave 1 -> kill -> upgrade ->
# game over -> restart; HUD; dash; combo; pause; mute; determinism; sizes)
node tools/playtest.mjs

# entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Run `main.ts` twice and `diff -r` the outputs: they are byte-identical.

## Playtest results

12/12 checks pass (see `tools/playtest.mjs`): title loads clean, start opens
wave 1, WASD + mouse fire work, dash grants cooldown + invulnerability, Nova
Bomb consumes one bomb, pause freezes time, mute is safe, wave clear offers 3
upgrades and opens wave 2, game over leads to a fresh restart on R, kills
award score + combo, `?shot=play` is deterministic across loads, and all four
screenshots are within the size cap.

## License

MIT — see `LICENSE`.
