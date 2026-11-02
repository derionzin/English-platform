import { ENEMIES } from './enemies.js';
import { inRect } from './draw-utils.js';

export function createStageSelect({ ctx, W, utils, progress, enemyView, game }) {
  const { roundedRect, text } = utils;

  const TOP = 104;
  const BOTTOM = 700;
  const GAP = 8;
  const count = ENEMIES.length;
  const cardH = Math.min(108, Math.floor((BOTTOM - TOP - (count - 1) * GAP) / count));
  const cards = ENEMIES.map((_, i) => ({ x: 24, y: TOP + i * (cardH + GAP), w: W - 48, h: cardH }));

  function drawLock(cx, cy) {
    ctx.save();
    ctx.strokeStyle = '#8a93a8';
    ctx.fillStyle = '#8a93a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 7, Math.PI, 0);
    ctx.stroke();
    roundedRect(cx - 10, cy - 4, 20, 15, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawCheck(cx, cy) {
    ctx.save();
    ctx.strokeStyle = '#51cf66';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 9, cy - 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawCard(i) {
    const e = ENEMIES[i];
    const c = cards[i];
    const unlocked = progress.isUnlocked(i);
    const defeated = progress.isDefeated(e.id);
    const current = unlocked && !defeated;
    const pad = 8;
    const box = c.h - pad * 2;

    roundedRect(c.x, c.y, c.w, c.h, 12);
    ctx.fillStyle = unlocked ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.lineWidth = current ? 2 : 1.5;
    ctx.strokeStyle = defeated ? 'rgba(81, 207, 102, 0.7)' : current ? '#ffd76a' : 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    // Animated preview, or a placeholder when there is no sprite
    const px = c.x + pad + box / 2;
    const py = c.y + c.h / 2;
    ctx.save();
    ctx.globalAlpha = unlocked ? 1 : 0.25;
    if (!enemyView.draw(i, 'idle', game.time, px, py, box, box)) {
      roundedRect(px - box / 2, py - box / 2, box, box, 10);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff6b6b';
      ctx.stroke();
      ctx.setLineDash([]);
      text(e.name.charAt(0), px, py + 8, 24, '#ff6b6b', 'center', 700);
    }
    ctx.restore();

    // Text
    const tx = c.x + pad * 2 + box;
    const roomy = c.h >= 84;
    const top = c.y + (roomy ? 28 : 22);
    text(e.name, tx, top, 18, unlocked ? '#ffffff' : '#8a93a8', 'left', 700);
    text(
      `HP ${e.hp}  ·  Damage ${e.damage}  ·  Every ${e.interval}s`,
      tx, top + (roomy ? 22 : 20), 13, unlocked ? '#c8cdd6' : '#6b7285', 'left'
    );
    if (roomy) {
      text(
        unlocked ? e.trait : `Defeat ${ENEMIES[i - 1].name} to unlock`,
        tx, top + 42, 12, unlocked ? '#8a93a8' : '#ffa94d', 'left'
      );
    }

    // Status on the right
    const sx = c.x + c.w - 38;
    if (defeated) {
      drawCheck(sx, c.y + c.h / 2 - 8);
      text('Defeated', sx, c.y + c.h / 2 + 18, 12, '#51cf66', 'center', 600);
    } else if (unlocked) {
      ctx.globalAlpha = 0.65 + Math.sin(game.time * 5) * 0.35;
      text('Fight', sx, c.y + c.h / 2 + 6, 17, '#ffd76a', 'center', 700);
      ctx.globalAlpha = 1;
    } else {
      drawLock(sx, c.y + c.h / 2 - 2);
    }
  }

  return {
    // Index of the card under the point, or -1.
    cardAt: (pt) => cards.findIndex((c) => inRect(pt, c)),

    draw() {
      text('Choose your enemy', W / 2, 42, 26, '#ffffff', 'center', 700);
      text('Beat an enemy to unlock the next one.', W / 2, 66, 14, '#c8cdd6');
      text('Drag across touching pieces of the same kind to link three or more.', W / 2, 86, 12, '#8a93a8');
      cards.forEach((_, i) => drawCard(i));
    },
  };
}