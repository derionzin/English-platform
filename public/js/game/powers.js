import { ELEMENTS } from './config.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createPowers({ layout, effects }) {
  const FLASH_TIME = 0.4;
  const meters = ELEMENTS.map(() => 0);
  const flash = ELEMENTS.map(() => 0);

  const powers = {
    meters,
    flash,
    FLASH_TIME,

    isReady: (type) => meters[type] >= ELEMENTS[type].meterMax,

    fill(type, pieces) {
      const el = ELEMENTS[type];
      if (!el.meterPerPiece) return;
      const wasReady = powers.isReady(type);
      meters[type] = Math.min(el.meterMax, meters[type] + pieces * el.meterPerPiece);
      flash[type] = FLASH_TIME;
      if (!wasReady && powers.isReady(type)) {
        const b = layout.powerButtons[type];
        effects.burst(b.x + b.w / 2, b.y + b.h / 2, el.color, 18);
        Assets.play('powerReady');
      }
    },

    consume(type) {
      meters[type] = 0;
    },

    // Index of the button under the point, or -1.
    buttonAt(x, y) {
      return layout.powerButtons.findIndex(
        (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
      );
    },

    reset() {
      meters.fill(0);
      flash.fill(0);
    },

    update(dt) {
      for (let i = 0; i < flash.length; i++) flash[i] = Math.max(0, flash[i] - dt);
    },
  };

  return powers;
}