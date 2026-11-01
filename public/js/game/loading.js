export function drawLoading(canvas, done, total) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const progress = total ? done / total : 1;

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, W, H);

  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('Loading...', W / 2, H / 2 - 24);

  const barW = 220;
  const barX = W / 2 - barW / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(barX, H / 2, barW, 10);
  ctx.fillStyle = '#6ee7ff';
  ctx.fillRect(barX, H / 2, barW * progress, 10);

  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = '#8a93a8';
  ctx.fillText(total ? `${done} / ${total}` : '', W / 2, H / 2 + 38);
}