const $ = (id) => document.getElementById(id);

const student = JSON.parse(localStorage.getItem('student') || 'null');
if (!student) location.href = '/';

const entry = JSON.parse(sessionStorage.getItem('gameEntry') || 'null');

/*
  Swap placeholders for PNGs here. Paths are relative to game.html,
  so 'img/gem-red.png' means public/img/gem-red.png.
  Leave a slot as null to keep its placeholder.
*/
const SPRITES = {
  pieces: [null, null, null, null, null], // five piece types
  enemy: null,
  player: null,
};

if (!entry) {
  $('message').hidden = false;
  $('message').innerHTML = 'Open the game from a lesson to bring your points with you. <a href="/student.html">Go to my lessons</a>';
} else {
  $('back').href = `/student.html?lesson=${entry.lessonId}`;
  $('pointsValue').textContent = entry.points;
  $('game').hidden = false;
  startGame(entry);
}

function startGame(entry) {
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Points brought from the lesson. Not used by the game yet.
  const lessonPoints = entry.points;

  /* ---------- Layout and tuning ---------- */

  const COLS = 7;
  const ROWS = 7;
  const CELL = 54;
  const TYPES = 5;
  const BOARD_W = COLS * CELL;
  const BOARD_H = ROWS * CELL;
  const BOARD_X = (W - BOARD_W) / 2;
  const BOARD_Y = 176;

  const ENEMY_BOX = { x: W / 2, y: 112, w: 170, h: 100 };
  const PLAYER_BOX = { x: W / 2, y: 598, w: 120, h: 56 };

  const MOVE_RATE = 16;
  const CLEAR_TIME = 0.22;
  const POINTS_PER_PIECE = 10;

  const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b', '#b18cff'];
  const SHAPES = [
    { sides: 0, rot: 0 },
    { sides: 3, rot: -Math.PI / 2 },
    { sides: 4, rot: Math.PI / 4 },
    { sides: 4, rot: 0 },
    { sides: 6, rot: 0 },
  ];

  /* ---------- Sprites ---------- */

  function loadImage(src) {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    return img;
  }
  const images = {
    pieces: SPRITES.pieces.map(loadImage),
    enemy: loadImage(SPRITES.enemy),
    player: loadImage(SPRITES.player),
  };
  const ready = (img) => !!img && img.complete && img.naturalWidth > 0;

  function drawFitted(img, cx, cy, w, h) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  /* ---------- State ---------- */

  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 20 + Math.random() * 60,
    r: 0.5 + Math.random() * 1.5,
  }));

  let state = 'ready'; // ready | playing
  let phase = 'fall'; // idle | swap | swapback | clear | fall
  let grid = [];
  let selected = null;
  let drag = null;
  let swapInfo = null;
  let clearing = [];
  let clearTimer = 0;
  let anyMoving = false;
  let combo = 0;
  let score = 0;
  let time = 0;
  let enemyShake = 0;
  let particles = [];
  let popups = [];
  let notice = { text: '', t: 0 };

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'pointer';

  const cellX = (c) => BOARD_X + c * CELL + CELL / 2;
  const cellY = (r) => BOARD_Y + r * CELL + CELL / 2;
  const randType = () => Math.floor(Math.random() * TYPES);

  function makePiece(type, r, c) {
    return { type, x: cellX(c), y: cellY(r), scale: 1, clearing: false };
  }

  /* ---------- Board logic ---------- */

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

  function buildBoard() {
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

    // Pieces drop in when the page opens.
    grid.forEach((row) => row.forEach((p) => { p.y -= BOARD_H + 40; }));
    phase = 'fall';
  }

  function shuffleBoard() {
    for (let attempt = 0; attempt < 200; attempt++) {
      grid.forEach((row) => row.forEach((p) => { p.type = randType(); }));
      if (findMatches().size === 0 && hasMoves()) break;
    }
    grid.forEach((row) => row.forEach((p) => { p.scale = 0.3; }));
    notice = { text: 'No moves left. Reshuffled!', t: 1.8 };
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
    phase = 'fall';
  }

  function startClear(matches) {
    clearing = [...matches].map((k) => ({ r: Math.floor(k / COLS), c: k % COLS }));
    clearing.forEach(({ r, c }) => { grid[r][c].clearing = true; });
    clearTimer = CLEAR_TIME;
    phase = 'clear';
  }

  function finishClear() {
    let sx = 0;
    let sy = 0;
    clearing.forEach(({ r, c }) => {
      const p = grid[r][c];
      sx += p.x;
      sy += p.y;
      burst(p.x, p.y, COLORS[p.type], 8);
      grid[r][c] = null;
    });
    const gain = clearing.length * POINTS_PER_PIECE * combo;
    score += gain;
    popups.push({
      x: sx / clearing.length,
      y: sy / clearing.length,
      text: combo > 1 ? `+${gain}  x${combo}` : `+${gain}`,
      life: 0.9,
      max: 0.9,
    });
    enemyShake = 0.3;
    clearing = [];
    applyGravity();
  }

  function trySwap(r1, c1, r2, c2) {
    if (phase !== 'idle') return;
    swapInfo = { r1, c1, r2, c2 };
    swapCells(r1, c1, r2, c2);
    selected = null;
    phase = 'swap';
  }

  /* ---------- Effects ---------- */

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      const life = 0.3 + Math.random() * 0.4;
      particles.push({
        x, y, color, life, max: life,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
  }

  /* ---------- Input ---------- */

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  }

  function cellAt(x, y) {
    const c = Math.floor((x - BOARD_X) / CELL);
    const r = Math.floor((y - BOARD_Y) / CELL);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (state === 'ready') {
      state = 'playing';
      return;
    }
    if (phase !== 'idle') return;

    const pt = toCanvas(e);
    const cell = cellAt(pt.x, pt.y);
    if (!cell) {
      selected = null;
      return;
    }
    if (selected && Math.abs(selected.r - cell.r) + Math.abs(selected.c - cell.c) === 1) {
      trySwap(selected.r, selected.c, cell.r, cell.c);
      drag = null;
      return;
    }
    selected = cell;
    drag = { x: pt.x, y: pt.y, cell };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || state !== 'playing' || phase !== 'idle') return;
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
    trySwap(from.r, from.c, r, c);
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- Update ---------- */

  function moveAll(dt) {
    anyMoving = false;
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
  }

  function update(dt) {
    time += dt;

    stars.forEach((s) => {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
    popups.forEach((p) => {
      p.y -= 40 * dt;
      p.life -= dt;
    });
    popups = popups.filter((p) => p.life > 0);
    enemyShake = Math.max(0, enemyShake - dt);
    notice.t = Math.max(0, notice.t - dt);

    moveAll(dt);

    if (phase === 'swap' && !anyMoving) {
      const matches = findMatches();
      if (matches.size) {
        combo = 1;
        startClear(matches);
      } else {
        const { r1, c1, r2, c2 } = swapInfo;
        swapCells(r1, c1, r2, c2);
        phase = 'swapback';
      }
    } else if (phase === 'swapback' && !anyMoving) {
      phase = 'idle';
    } else if (phase === 'clear') {
      clearTimer -= dt;
      const s = Math.max(0, clearTimer / CLEAR_TIME);
      clearing.forEach(({ r, c }) => { grid[r][c].scale = s; });
      if (clearTimer <= 0) finishClear();
    } else if (phase === 'fall' && !anyMoving) {
      const matches = findMatches();
      if (matches.size) {
        combo++;
        startClear(matches);
      } else {
        combo = 0;
        if (!hasMoves()) shuffleBoard();
        phase = 'idle';
      }
    }
  }

  /* ---------- Drawing ---------- */

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'center', weight = 400) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  }

  function drawPiece(p, pulse) {
    const img = images.pieces[p.type];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale * pulse, p.scale * pulse);
    ctx.globalAlpha = p.clearing ? Math.max(0, p.scale) : 1;

    if (ready(img)) {
      drawFitted(img, 0, 0, CELL - 8, CELL - 8);
    } else {
      const R = CELL * 0.36;
      const shape = SHAPES[p.type];
      ctx.fillStyle = COLORS[p.type];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (shape.sides === 0) {
        ctx.arc(0, 0, R, 0, Math.PI * 2);
      } else {
        for (let i = 0; i < shape.sides; i++) {
          const a = shape.rot + (i * Math.PI * 2) / shape.sides;
          const x = Math.cos(a) * R;
          const y = Math.sin(a) * R;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlaceholder(box, label, color, img, offsetX, offsetY) {
    ctx.save();
    ctx.translate(box.x + offsetX, box.y + offsetY);
    if (ready(img)) {
      drawFitted(img, 0, 0, box.w, box.h);
    } else {
      roundedRect(-box.w / 2, -box.h / 2, box.w, box.h, 12);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
      text(label, 0, 2, 18, color, 'center', 600);
      text('PNG goes here', 0, 24, 12, color);
    }
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#ffffff';
    stars.forEach((s) => {
      ctx.globalAlpha = 0.3 + s.r / 3;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.globalAlpha = 1;

    const shake = enemyShake > 0 ? Math.sin(time * 60) * 6 * (enemyShake / 0.3) : 0;
    drawPlaceholder(ENEMY_BOX, 'ENEMY', '#ff6b6b', images.enemy, shake, Math.sin(time * 2) * 3);

    roundedRect(BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, BOARD_H + 12, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, CELL);
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.clip();
    const pulse = 1 + Math.sin(time * 8) * 0.05;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        const isSelected = selected && selected.r === r && selected.c === c;
        drawPiece(p, isSelected ? 1.08 + (pulse - 1) : 1);
      }
    }
    ctx.restore();

    if (selected && phase === 'idle') {
      roundedRect(BOARD_X + selected.c * CELL + 2, BOARD_Y + selected.r * CELL + 2, CELL - 4, CELL - 4, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    drawPlaceholder(PLAYER_BOX, 'PLAYER', '#6ee7ff', images.player, 0, Math.sin(time * 2.4) * 2);

    popups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      text(p.text, p.x, p.y, 20, '#ffd76a', 'center', 700);
    });
    ctx.globalAlpha = 1;

    text(`★ ${lessonPoints} lesson points`, 16, 32, 16, '#ffd76a', 'left', 600);
    text(`Score ${score}`, W - 16, 32, 18, '#ffffff', 'right', 600);
    if (combo > 1 && (phase === 'clear' || phase === 'fall')) {
      text(`Combo x${combo}`, W / 2, 32, 16, '#6ee7ff', 'center', 600);
    }

    if (notice.t > 0) {
      const y = BOARD_Y + BOARD_H / 2;
      roundedRect(W / 2 - 130, y - 20, 260, 40, 20);
      ctx.fillStyle = 'rgba(11, 16, 32, 0.85)';
      ctx.fill();
      text(notice.text, W / 2, y + 6, 16, '#ffffff');
    }

    if (state === 'ready') {
      ctx.fillStyle = 'rgba(11, 16, 32, 0.7)';
      ctx.fillRect(0, 0, W, H);
      text('Match three', W / 2, H / 2 - 70, 34, '#ffffff', 'center', 600);
      text('Tap or click to start', W / 2, H / 2 - 30, 18, '#ffd76a');
      text('Swap two neighbouring pieces to line up', W / 2, H / 2 + 10, 15, '#c8cdd6');
      text('three or more of the same kind.', W / 2, H / 2 + 32, 15, '#c8cdd6');
      text('Tap two pieces, or drag one.', W / 2, H / 2 + 54, 15, '#c8cdd6');
      text(`★ ${lessonPoints} lesson points ready`, W / 2, H / 2 + 98, 15, '#6ee7ff');
    }
  }

  /* ---------- Start ---------- */

  buildBoard();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}