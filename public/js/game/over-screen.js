import { ENEMIES } from './enemies.js';
import { inRect } from './draw-utils.js';

export function createOverScreen({ ctx, W, H, utils, progress, battle, game }) {
  const { roundedRect, text } = utils;

  function buttons() {
    const list = [];
    const index = ENEMIES.indexOf(battle.enemy);
    const next = ENEMIES[index + 1];
    if (game.result === 'win' && next && progress.isUnlocked(index + 1)) {
      list.push({ id: 'next', label: `Next: ${next.name}`, primary: true });
    }
    list.push({
      id: 'again',
      label: game.result === 'win' ? 'Fight again' : 'Try again',
      primary: list.length === 0,
    });
    list.push({ id: 'select', label: 'Enemy select', primary: false });
    list.forEach((b, i) => {
      b.x = W / 2 - 120;
      b.y = H / 2 + 48 + i * 54;
      b.w = 240;
      b.h = 44;
    });
    return list;
  }

  return {
    // Which button was pressed ('next', 'again' or 'select'), or null.
    hit(pt) {
      if (performance.now() - game.overAt < 700) return null;
      const b = buttons().find((btn) => inRect(pt, btn));
      return b ? b.id : null;
    },

    draw() {
      const won = game.result === 'win';
      const enemy = battle.enemy;

      ctx.fillStyle = 'rgba(11, 16, 32, 0.8)';
      ctx.fillRect(0, 0, W, H);

      text(won ? 'Victory!' : 'Defeat', W / 2, H / 2 - 120, 38, won ? '#ffd76a' : '#ff6b6b', 'center', 700);
      text(won ? `${enemy.name} defeated` : `${enemy.name} wins this round`, W / 2, H / 2 - 92, 16, '#c8cdd6');
      text(`Score ${game.score}`, W / 2, H / 2 - 56, 22, '#ffffff', 'center', 600);
      text(`+${game.runXp} XP${game.replay ? ' (replay)' : ''}`, W / 2, H / 2 - 28, 18, '#74c0fc', 'center', 600);

      let y = H / 2 - 4;
      if (progress.points > 0) {
        text(
          `${progress.points} stat point${progress.points === 1 ? '' : 's'} to spend`,
          W / 2, y, 16, '#ffd76a', 'center', 600
        );
        y += 26;
      }
      if (game.unlockedName) {
        text(`${game.unlockedName} unlocked!`, W / 2, y, 16, '#51cf66', 'center', 700);
      }

      const ready = performance.now() - game.overAt >= 700;
      ctx.globalAlpha = ready ? 1 : 0.4;
      buttons().forEach((b) => {
        roundedRect(b.x, b.y, b.w, b.h, 10);
        ctx.fillStyle = b.primary ? '#2f6fed' : 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, 16, b.primary ? '#ffffff' : '#c8cdd6', 'center', 600);
      });
      ctx.globalAlpha = 1;
    },
  };
}