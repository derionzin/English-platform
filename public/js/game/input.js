import { ROWS, COLS, CELL } from './config.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createInput({ canvas, board, game, onStart, onRestart, onSwap }) {
  let selected = null;
  let drag = null;

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'pointer';

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    Assets.unlock();

    if (game.state === 'ready') {
      onStart();
      return;
    }
    if (game.state === 'over') {
      onRestart();
      return;
    }
    if (game.phase !== 'idle') return;

    const pt = toCanvas(e);
    const cell = board.cellAt(pt.x, pt.y);
    if (!cell) {
      selected = null;
      return;
    }
    if (selected && Math.abs(selected.r - cell.r) + Math.abs(selected.c - cell.c) === 1) {
      onSwap(selected.r, selected.c, cell.r, cell.c);
      drag = null;
      return;
    }
    selected = cell;
    Assets.play('select');
    drag = { x: pt.x, y: pt.y, cell };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || game.state !== 'playing' || game.phase !== 'idle') return;
    const pt = toCanvas(e);
    const dx = pt.x - drag.x;
    const dy = pt.y - drag.y;
    if (Math.hypot(dx, dy) < CELL * 0.45) return;

    const from = drag.cell;
    let { r, c } = from;
    if (Math.abs(dx) > Math.abs(dy)) c += dx > 0 ? 1 : -1;
    else r += dy > 0 ? 1 : -1;
    drag = null;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    onSwap(from.r, from.c, r, c);
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get selected() { return selected; },
    clearSelection() { selected = null; },
    reset() { selected = null; drag = null; },
  };
}