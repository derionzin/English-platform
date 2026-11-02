import { ENEMIES, enemyImageKey } from './enemies.js';
import { createSpriteSheet, createAnimator } from './animation.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createEnemyView(ctx, utils) {
  const views = ENEMIES.map((enemy) => {
    const sprite = enemy.sprite;
    const img = Assets.image(enemyImageKey(enemy));
    if (!sprite || !utils.ready(img)) return null;

    const sheet = createSpriteSheet(img, {
      cols: sprite.cols,
      rows: sprite.rows,
      smooth: !sprite.pixelArt,
    });
    const anims = {};
    for (const [name, state] of Object.entries(sprite.states)) {
      anims[name] = createAnimator({ frames: state.frames, fps: state.fps, mode: state.mode || 'loop' });
    }
    return { sheet, anims, states: sprite.states };
  });

  return {
    has: (index) => !!views[index],

    // Draws one enemy inside a w x h box centered on cx, cy. `time` is seconds into
    // the animation. With alignBottom the sprite sits on the bottom edge of the box.
    // Returns false when the enemy has no sprite, so the caller can draw a placeholder.
    draw(index, stateName, time, cx, cy, w, h, alignBottom = false) {
      const view = views[index];
      if (!view) return false;
      const name = view.states[stateName] ? stateName : 'idle';
      const state = view.states[name];
      if (!state) return false;

      let y = cy;
      if (alignBottom) {
        const scale = Math.min(w / view.sheet.frameW, h / view.sheet.frameH);
        y = cy + h / 2 - (view.sheet.frameH * scale) / 2;
      }
      view.sheet.draw(ctx, view.anims[name].frameAt(time), state.row, cx, y, w, h);
      return true;
    },
  };
}