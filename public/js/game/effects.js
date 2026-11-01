export function createEffects(W, H) {
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 20 + Math.random() * 60,
    r: 0.5 + Math.random() * 1.5,
  }));
  let particles = [];
  let popups = [];
  const notice = { text: '', t: 0 };

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

  function spark(x, y, color) {
    particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      color,
      life: 0.35,
      max: 0.35,
      vx: (Math.random() - 0.5) * 50,
      vy: (Math.random() - 0.5) * 50,
    });
  }

  // Floating text such as "+30" or "-10". Color is optional.
  function popup({ x, y, text, color }) {
    popups.push({ x, y, text, color, life: 0.9, max: 0.9 });
  }

  function showNotice(text, seconds = 1.8) {
    notice.text = text;
    notice.t = seconds;
  }

  function clear() {
    particles = [];
    popups = [];
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
    popups.forEach((p) => {
      p.y -= 40 * dt;
      p.life -= dt;
    });
    popups = popups.filter((p) => p.life > 0);
    notice.t = Math.max(0, notice.t - dt);
  }

  function drawStars(ctx) {
    ctx.fillStyle = '#ffffff';
    stars.forEach((s) => {
      ctx.globalAlpha = 0.3 + s.r / 3;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.globalAlpha = 1;
  }

  function drawParticles(ctx) {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawPopups(ctx, drawText) {
    popups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      drawText(p.text, p.x, p.y, 20, p.color || '#ffd76a', 'center', 700);
    });
    ctx.globalAlpha = 1;
  }

  return { notice, burst, spark, popup, showNotice, clear, update, drawStars, drawParticles, drawPopups };
}