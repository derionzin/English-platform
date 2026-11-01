import {
  COLS, ROWS, CELL, TYPES, MOVE_RATE, PIECE_SHEET, ALLOW_DIAGONALS, MIN_CHAIN,
} from './config.js';

export function createBoard(layout) {
  const { boardX, boardY, boardH } = layout;
  let grid = [];

  const cellX = (c) => boardX + c * CELL + CELL / 2;
  const cellY = (r) => boardY + r * CELL + CELL / 2;
  const randType = () => Math.floor(Math.random() * TYPES);

  function makePiece(type, r, c) {
    return {
      type,
      x: cellX(c),
      y: cellY(r),
      scale: 1,
      clearing: false,
      phase: PIECE_SHEET.desync ? Math.random() * 10 : 0,
      animStart: null,
    };
  }

  function cellAt(x, y) {
    const c = Math.floor((x - boardX) / CELL);
    const r = Math.floor((y - boardY) / CELL);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
  }

  const centerOf = (r, c) => ({ x: cellX(c), y: cellY(r) });
  const typeAt = (r, c) => (grid[r][c] ? grid[r][c].type : -1);

  function areNeighbors(a, b) {
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    if (dr === 0 && dc === 0) return false;
    return ALLOW_DIAGONALS ? dr <= 1 && dc <= 1 : dr + dc === 1;
  }

  // True if some group of touching same-kind pieces is big enough to clear.
  function hasMoves() {
    const seen = new Set();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (seen.has(r * COLS + c) || !grid[r][c]) continue;
        const type = typeAt(r, c);
        const stack = [{ r, c }];
        seen.add(r * COLS + c);
        let size = 0;
        while (stack.length) {
          const cur = stack.pop();
          if (++size >= MIN_CHAIN) return true;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const next = { r: cur.r + dr, c: cur.c + dc };
              if (next.r < 0 || next.r >= ROWS || next.c < 0 || next.c >= COLS) continue;
              if (!areNeighbors(cur, next)) continue;
              const key = next.r * COLS + next.c;
              if (seen.has(key) || typeAt(next.r, next.c) !== type) continue;
              seen.add(key);
              stack.push(next);
            }
          }
        }
      }
    }
    return false;
  }

  function build() {
    do {
      grid = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) row.push(makePiece(randType(), r, c));
        grid.push(row);
      }
    } while (!hasMoves());

    // Pieces drop in when the board is built.
    grid.forEach((row) => row.forEach((p) => { p.y -= boardH + 40; }));
  }

  function shuffle() {
    for (let attempt = 0; attempt < 200; attempt++) {
      grid.forEach((row) => row.forEach((p) => { p.type = randType(); }));
      if (hasMoves()) break;
    }
    grid.forEach((row) => row.forEach((p) => { p.scale = 0.3; }));
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c]) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = null;
          write--;
        }
      }
      const missing = write + 1;
      for (let r = write; r >= 0; r--) {
        const p = makePiece(randType(), r, c);
        p.y = cellY(r) - missing * CELL - 10;
        grid[r][c] = p;
      }
    }
  }

  // Marks the chosen cells as clearing and returns them.
  function markClearing(cells) {
    cells.forEach(({ r, c }) => { grid[r][c].clearing = true; });
    return cells;
  }

  // Every piece of one type that is on the board.
  function cellsOfType(type) {
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (p && p.type === type && !p.clearing) cells.push({ r, c });
      }
    }
    return cells;
  }


  function setClearScale(cells, s) {
    cells.forEach(({ r, c }) => { grid[r][c].scale = s; });
  }

  // Empties the cells and returns the pieces that were there.
  function removeCells(cells) {
    return cells.map(({ r, c }) => {
      const p = grid[r][c];
      grid[r][c] = null;
      return p;
    });
  }

  // Slides every piece toward its cell. Returns true while anything is moving.
  function move(dt) {
    let anyMoving = false;
    const k = Math.min(1, MOVE_RATE * dt);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        const tx = cellX(c);
        const ty = cellY(r);
        const dx = tx - p.x;
        const dy = ty - p.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          p.x = tx;
          p.y = ty;
        } else {
          p.x += dx * k;
          p.y += dy * k;
          anyMoving = true;
        }
        if (!p.clearing) p.scale += (1 - p.scale) * k;
      }
    }
    return anyMoving;
  }

  return {
    get grid() { return grid; },
    cellAt, centerOf, typeAt, areNeighbors, hasMoves, cellsOfType,
    build, shuffle, applyGravity,
    markClearing, setClearScale, removeCells, move,
  };
}