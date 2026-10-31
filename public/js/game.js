const $ = (id) => document.getElementById(id);

const student = JSON.parse(localStorage.getItem('student') || 'null');
if (!student) location.href = '/';

const entry = JSON.parse(sessionStorage.getItem('gameEntry') || 'null');

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

  const BASE_LIVES = 1;
  const POINTS_PER_LIFE = 10;
  const MAX_LIVES = 10;
  const TOUCH_OFFSET = 40;
  const FIRE_INTERVAL = 0.18;

  const startLives = Math.min(MAX_LIVES, BASE_LIVES + Math.floor(entry.points / POINTS_PER_LIFE));

  const bestKey = `bestScore-${student.id}`;
  let best = 0;
  try { best = Number(localStorage.getItem(bestKey)) || 0; } catch {}

  const pointer = { x: W / 2, y: H - 100 };
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 20 + Math.random() * 60,
    r: 0.5 + Math.random() * 1.5,
  }));

  let state = 'ready';
  let overAt = 0;
  let player, bullets, enemies, particles;
  let score, lives, elapsed, spawnTimer, fireTimer;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const hit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

  function setState(next) {
    state = next;
    canvas.style.cursor = next === 'playing' ? 'none' : 'pointer';
  }

  function reset() {
    player = { x: W / 2, y: H - 100, r: 11, invuln: 0 };
    bullets = [];
    enemies = [];
    particles = [];
    score = 0;
    lives = startLives;
    elapsed = 0;
    spawnTimer = 0.5;
    fireTimer = 0;
  }
  reset();
  setState('ready');

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const offset = e.pointerType === 'touch' ? TOUCH_OFFSET : 0;
    pointer.x = (e.clientX - rect.left) * (W / rect.width);
    pointer.y = (e.clientY - rect.top) * (H / rect.height) - offset;
  }

  canvas.addEventListener('pointermove', setPointer);
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    setPointer(e);
    if (state === 'ready' || state === 'paused') {
      setState('playing');
    } else if (state === 'over' && performance.now() - overAt > 700) {
      reset();
      setState('playing');
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') setState('paused');
  });

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      const life = 0.3 + Math.random() * 0.5;
      particles.push({
        x, y, color, life, max: life,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
  }

  function spawnEnemy() {
    const tough = elapsed > 15 && Math.random() < 0.25;
    const r = tough ? 24 : 16;
    const amp = Math.random() * 40;
    enemies.push({
      baseX: r + amp + Math.random() * (W - 2 * (r + amp)),
      x: 0,
      y: -r,
      r,
      amp,
      freq: 1 + Math.random() * 2,
      t: Math.random() * 6,
      hp: tough ? 3 : 1,
      reward: tough ? 30 : 10,
      color: tough ? '#b18cff' : '#ff6b6b',
      speed: Math.min(260, 70 + Math.random() * 50 + elapsed * 1.5) * (tough ? 0.7 : 1),
    });
  }

  function endGame() {
    setState('over');
    overAt = performance.now();
    if (score > best) {
      best = score;
      try { localStorage.setItem(bestKey, String(best)); } catch {}
    }
  }

  function update(dt) {
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

    if (state !== 'playing') return;
    elapsed += dt;

    const follow = Math.min(1, 18 * dt);
    player.x += (pointer.x - player.x) * follow;
    player.y += (pointer.y - player.y) * follow;
    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, H * 0.25, H - player.r);
    player.invuln = Math.max(0, player.invuln - dt);

    fireTimer -= dt;
    if (fireTimer <= 0) {
      fireTimer = FIRE_INTERVAL;
      bullets.push({ x: player.x, y: player.y - 16, r: 3 });
    }
    bullets.forEach((b) => { b.y -= 640 * dt; });

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.35, 1 - elapsed * 0.01);
      spawnEnemy();
    }
    enemies.forEach((e) => {
      e.t += dt;
      e.y += e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * e.freq) * e.amp;
    });

    bullets.forEach((b) => {
      enemies.forEach((e) => {
        if (b.dead || e.dead || !hit(b, e)) return;
        b.dead = true;
        e.hp--;
        burst(b.x, b.y, '#ffd76a', 3);
        if (e.hp <= 0) {
          e.dead = true;
          score += e.reward;
          burst(e.x, e.y, e.color, 14);
        }
      });
    });

    for (const e of enemies) {
      if (e.dead || player.invuln > 0 || !hit(e, player)) continue;
      e.dead = true;
      burst(e.x, e.y, e.color, 14);
      lives--;
      player.invuln = 1.6;
      if (lives <= 0) {
        burst(player.x, player.y, '#6ee7ff', 30);
        endGame();
        break;
      }
    }

    bullets = bullets.filter((b) => !b.dead && b.y > -10);
    enemies = enemies.filter((e) => !e.dead && e.y < H + e.r + 10);
  }

  function shipPath(x, y, r, dir) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * dir);
    ctx.lineTo(x + r, y + r * dir * 0.8);
    ctx.lineTo(x, y + r * dir * 0.4);
    ctx.lineTo(x - r, y + r * dir * 0.8);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'center', weight = 400) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
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

    enemies.forEach((e) => {
      ctx.fillStyle = e.color;
      shipPath(e.x, e.y, e.r, -1);
      ctx.fill();
    });

    ctx.fillStyle = '#ffd76a';
    bullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));

    if (state !== 'over' && (player.invuln === 0 || Math.floor(player.invuln * 12) % 2 === 0)) {
      ctx.fillStyle = '#6ee7ff';
      shipPath(player.x, player.y, 16, 1);
      ctx.fill();
    }

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#6ee7ff';
    for (let i = 0; i < lives; i++) {
      shipPath(22 + i * 22, 28, 8, 1);
      ctx.fill();
    }
    text(`Score ${score}`, W - 16, 32, 18, '#ffffff', 'right', 600);
    text(`Best ${Math.max(best, score)}`, W - 16, 54, 13, '#8a93a8', 'right');

    if (state !== 'playing') {
      ctx.fillStyle = 'rgba(11, 16, 32, 0.65)';
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'ready') {
      text('Ready?', W / 2, H / 2 - 70, 34, '#ffffff', 'center', 600);
      text('Tap or click to start', W / 2, H / 2 - 30, 18, '#ffd76a');
      text('Move your mouse or finger to fly.', W / 2, H / 2 + 10, 15, '#c8cdd6');
      text('Your ship fires on its own.', W / 2, H / 2 + 32, 15, '#c8cdd6');
      text(`${startLives} ${startLives === 1 ? 'life' : 'lives'} from ${entry.points} lesson points`, W / 2, H / 2 + 76, 15, '#6ee7ff');
    } else if (state === 'paused') {
      text('Paused', W / 2, H / 2 - 10, 34, '#ffffff', 'center', 600);
      text('Tap or click to continue', W / 2, H / 2 + 24, 18, '#ffd76a');
    } else if (state === 'over') {
      text('Game over', W / 2, H / 2 - 70, 34, '#ffffff', 'center', 600);
      text(`Score ${score}`, W / 2, H / 2 - 28, 22, '#ffd76a');
      text(`Best ${best}`, W / 2, H / 2 + 4, 16, '#c8cdd6');
      if (performance.now() - overAt > 700) {
        text('Tap or click to play again', W / 2, H / 2 + 52, 18, '#ffffff');
      }
    }
  }

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