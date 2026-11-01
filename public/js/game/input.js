import { CELL, MIN_CHAIN, HIT_RADIUS } from './config.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createInput({ canvas, board, game, onStart, onRestart, onChain }) {
  let chain = [];
  let dragging = false;
  let lastPt = null;

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'pointer';

  const sameCell = (a, b) => a.r === b.r && a.c === b.c;
  const canPlay = () => game.state === 'playing' && game.phase === 'idle';

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  // Only counts when the pointer is near the middle of a piece,
  // so cutting a corner doesn't link the wrong piece.
  function cellUnder(pt) {
    const cell = board.cellAt(pt.x, pt.y);
    if (!cell) return null;
    const center = board.centerOf(cell.r, cell.c);
    return Math.hypot(pt.x - center.x, pt.y - center.y) <= CELL * HIT_RADIUS ? cell : null;
  }

  function linkSound() {
    Assets.play('select', { rate: Math.min(1 + (chain.length - 1) * 0.07, 1.8) });
  }

  function extend(pt) {
    const cell = cellUnder(pt);
    if (!cell) return;
    const last = chain[chain.length - 1];
    if (sameCell(cell, last)) return;

    // Dragging back onto the previous piece undoes the last link.
    if (chain.length >= 2 && sameCell(cell, chain[chain.length - 2])) {
      chain.pop();
      return;
    }
    if (chain.some((c) => sameCell(c, cell))) return;
    if (!board.areNeighbors(last, cell)) return;
    if (board.typeAt(cell.r, cell.c) !== board.typeAt(last.r, last.c)) return;

    chain.push(cell);
    linkSound();
  }

  function finish() {
    if (!dragging) return;
    dragging = false;
    const done = chain;
    chain = [];
    if (done.length >= MIN_CHAIN) onChain(done);
    else if (done.length > 1) Assets.play('invalid');
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
    if (!canPlay()) return;

    const pt = toCanvas(e);
    const cell = board.cellAt(pt.x, pt.y);
    if (!cell) return;
    chain = [cell];
    dragging = true;
    lastPt = pt;
    linkSound();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !canPlay()) return;
    const pt = toCanvas(e);

    // Follow the pointer in small steps so a fast drag can't skip over a piece.
    const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
    const steps = Math.max(1, Math.ceil(dist / (CELL * 0.25)));
    for (let i = 1; i <= steps; i++) {
      extend({
        x: lastPt.x + ((pt.x - lastPt.x) * i) / steps,
        y: lastPt.y + ((pt.y - lastPt.y) * i) / steps,
      });
    }
    lastPt = pt;
  });

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => {
    dragging = false;
    chain = [];
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get chain() { return chain; },
    reset() { chain = []; dragging = false; },
  };
}