// All screen overlays for Nova Drift: the in-play HUD, title, upgrade choice,
// pause and game-over screens. The world itself (arena, ships, bullets) is drawn
// by main.js; this module only paints text and panels over it.
import { PALETTE } from './palette.js';
import { UPGRADES } from './upgrades.js';

export const CARD_LAYOUT = { x: 166, y: 200, w: 300, h: 340, gap: 24 };

/** Which upgrade card (0, 1, 2) sits under canvas point (x, y), or -1. */
export function upgradeCardAt(x, y) {
  const { x: cx, y: cy, w, h, gap } = CARD_LAYOUT;
  for (let i = 0; i < 3; i += 1) {
    const left = cx + i * (w + gap);
    if (x >= left && x <= left + w && y >= cy && y <= cy + h) return i;
  }
  return -1;
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  ctx.fillStyle = bg || 'rgba(5,7,26,0.8)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(245,237,216,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHUD(ctx, state, best) {
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Hull bar, top left.
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HULL', 20, 26);
  const hpFrac = p.hp / p.maxHp;
  bar(ctx, 20, 34, 240, 16, hpFrac, hpFrac > 0.5 ? PALETTE.hpGood : hpFrac > 0.25 ? PALETTE.gold : PALETTE.hpLow);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 268, 47);

  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave}`, 640, 30);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText(state.phase === 'upgrade' ? 'CHOOSE AN UPGRADE' : `${state.enemies.length} HOSTILES LEFT`, 640, 50);

  // Boss health bar when a Bulwark is on the field.
  const boss = state.enemies.find((e) => e.kind === 'bulwark');
  if (boss) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('BULWARK', 640, 72);
    bar(ctx, 490, 78, 300, 10, boss.hp / boss.maxHp, PALETTE.amber);
  }

  // Score, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(String(state.score).padStart(6, '0'), 1260, 32);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`BEST ${best}`, 1260, 50);
  if (state.combo >= 2) {
    ctx.fillStyle = state.combo >= 5 ? PALETTE.amber : PALETTE.teal;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`COMBO x${Math.min(state.combo, 8)}`, 1260, 76);
  }

  // Dash cooldown + bombs, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('DASH [SPACE]', 20, 682);
  const dashFrac = p.dashCooldownMax > 0 ? 1 - Math.max(0, p.dashCooldown) / p.dashCooldownMax : 1;
  bar(ctx, 20, 690, 120, 10, dashFrac, p.dashCooldown <= 0 ? PALETTE.teal : PALETTE.tealDim);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`NOVA BOMB ✺ x${p.bombs}  [E]`, 160, 682);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('PAUSE [ESC]  MUTE [M]  RESTART [R]', 160, 700);

  // Owned upgrades, bottom right.
  const owned = UPGRADES.filter((u) => (p.upgradeLevels[u.id] || 0) > 0);
  ctx.textAlign = 'right';
  ctx.font = '12px system-ui, sans-serif';
  owned.forEach((u, i) => {
    ctx.fillStyle = PALETTE.teal;
    ctx.fillText(`${u.icon} ${u.name} Lv${p.upgradeLevels[u.id]}`, 1260, 682 - i * 16);
  });

  // Upgrade-picked banner.
  if (state.upgradeFlash) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, state.upgradeFlash.timer);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`${state.upgradeFlash.name} — Lv ${state.upgradeFlash.level}`, 640, 120);
    ctx.globalAlpha = 1;
  }

  // Low-hull vignette.
  if (hpFrac < 0.3 && state.phase === 'play') {
    const pulse = 0.22 + 0.1 * Math.sin(state.time * 6);
    const grad = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
    grad.addColorStop(0, 'rgba(255,77,109,0)');
    grad.addColorStop(1, `rgba(255,77,109,${pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);
  }
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(4,5,26,${alpha})`;
  ctx.fillRect(0, 0, 1280, 720);
}

export function drawTitleScreen(ctx, best, time) {
  dim(ctx, 0.45);
  ctx.textAlign = 'center';
  const bob = Math.sin(time * 1.4) * 6;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(245,185,66,0.7)';
  ctx.shadowBlur = 34;
  ctx.fillText('NOVA DRIFT', 640, 250 + bob);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.teal;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('— GRAVITY ARENA —', 640, 296 + bob);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Twin-stick survival among gravity wells. Bullets bend. So do you.', 640, 340 + bob);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('WASD move  ·  MOUSE aim + hold to fire  ·  SPACE dash  ·  E nova bomb', 640, 400);
  ctx.fillText('Clear a wave, pick 1 of 3 upgrades, survive the Bulwark every 5th wave.', 640, 426);
  if (best > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${best}`, 640, 470);
  }
  const blink = 0.55 + 0.45 * Math.sin(time * 3.2);
  ctx.globalAlpha = blink;
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS SPACE TO START', 640, 540);
  ctx.globalAlpha = 1;
}

export function drawUpgradeScreen(ctx, state) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave} CLEAR`, 640, 120);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Choose one upgrade — click a card or press 1 / 2 / 3', 640, 152);
  const { x, y, w, h, gap } = CARD_LAYOUT;
  state.upgradeChoices.forEach((choice, i) => {
    const left = x + i * (w + gap);
    ctx.fillStyle = PALETTE.cardBg;
    ctx.fillRect(left, y, w, h);
    ctx.strokeStyle = PALETTE.cardEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(left + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, left + w / 2, y + 40);
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText(choice.icon, left + w / 2, y + 108);
    ctx.fillStyle = PALETTE.cream;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(choice.name, left + w / 2, y + 152);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, choice.desc, left + w / 2, y + 190, w - 44, 22);
    const level = (state.player.upgradeLevels[choice.id] || 0) + 1;
    const alreadyMaxed = (state.player.upgradeLevels[choice.id] || 0) >= choice.max;
    ctx.fillStyle = PALETTE.teal;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(alreadyMaxed ? 'MAX LEVEL' : `BECOMES Lv ${level}`, left + w / 2, y + h - 26);
  });
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = words[i];
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, cx, yy);
}

export function drawGameOverScreen(ctx, state, best) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.red;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255,77,109,0.6)';
  ctx.shadowBlur = 28;
  ctx.fillText('SIGNAL LOST', 640, 220);
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Your ship broke apart in the drift.', 640, 262);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(`SCORE  ${state.score}`, 640, 340);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`WAVE ${state.wave}   ·   ${state.kills} KILLS   ·   BEST ${Math.max(best, state.score)}`, 640, 392);
  const blink = 0.55 + 0.45 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = blink;
  ctx.fillStyle = PALETTE.cream;
  ctx.shadowColor = 'rgba(245,237,216,0.6)';
  ctx.shadowBlur = 12;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', 640, 560);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function drawPausedScreen(ctx) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.cream;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('PAUSED', 640, 330);
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('ESC or P to resume  ·  M to mute  ·  R to restart', 640, 372);
}
