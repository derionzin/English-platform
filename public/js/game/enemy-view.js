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

    // Draws one enemy centered on cx, cy. `time` is seconds into the animation.
    // Returns false when the enemy has no sprite, so the caller can draw a placeholder.
    draw(index, stateName, time, cx, cy, w, h) {
      const view = views[index];
      if (!view) return false;
      const name = view.states[stateName] ? stateName : 'idle';
      const state = view.states[name];
      if (!state) return false;
      view.sheet.draw(ctx, view.anims[name].frameAt(time), state.row, cx, cy, w, h);
      return true;
    },
  };
}