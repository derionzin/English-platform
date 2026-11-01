import { COLS, ROWS, CELL, TYPES, MOVE_RATE, PIECE_SHEET } from './config.js';

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
    };
  }

  function cellAt(x, y) {
    const c = Math.floor((x - boardX) / CELL);
    const r = Math.floor((y - boardY) / CELL);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
  }

  function findMatches() {
    const found = new Set();
    const typeAt = (r, c) => (grid[r][c] ? grid[r][c].type : -1);

    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        let e = c;
        while (e + 1 < COLS && typeAt(r, e + 1) === typeAt(r, c)) e++;
        if (e - c >= 2 && typeAt(r, c) !== -1) {
          for (let k = c; k <= e; k++) found.add(r * COLS + k);
        }
        c = e + 1;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        let e = r;
        while (e + 1 < ROWS && typeAt(e + 1, c) === typeAt(r, c)) e++;
        if (e - r >= 2 && typeAt(r, c) !== -1) {
          for (let k = r; k <= e; k++) found.add(k * COLS + c);
        }
        r = e + 1;
      }
    }
    return found;
  }

  function swapCells(r1, c1, r2, c2) {
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
  }

  function hasMoves() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c + 1 < COLS) {
          swapCells(r, c, r, c + 1);
          const ok = findMatches().size > 0;
          swapCells(r, c, r, c + 1);
          if (ok) return true;
        }
        if (r + 1 < ROWS) {
          swapCells(r, c, r + 1, c);
          const ok = findMatches().size > 0;
          swapCells(r, c, r + 1, c);
          if (ok) return true;
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
        for (let c = 0; c < COLS; c++) {
          let t;
          do {
            t = randType();
          } while (
            (c >= 2 && row[c - 1].type === t && row[c - 2].type === t) ||
            (r >= 2 && grid[r - 1][c].type === t && grid[r - 2][c].type === t)
          );
          row.push(makePiece(t, r, c));
        }
        grid.push(row);
      }
    } while (!hasMoves());

    // Pieces drop in when the board is built.
    grid.forEach((row) => row.forEach((p) => { p.y -= boardH + 40; }));
  }

  function shuffle() {
    for (let attempt = 0; attempt < 200; attempt++) {
      grid.forEach((row) => row.forEach((p) => { p.type = randType(); }));
      if (findMatches().size === 0 && hasMoves()) break;
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

  // Marks matched pieces as clearing and returns their cells.
  function markClearing(matches) {
    const cells = [...matches].map((k) => ({ r: Math.floor(k / COLS), c: k % COLS }));
    cells.forEach(({ r, c }) => { grid[r][c].clearing = true; });
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
    cellAt, findMatches, swapCells, hasMoves,
    build, shuffle, applyGravity,
    markClearing, setClearScale, removeCells, move,
  };
}