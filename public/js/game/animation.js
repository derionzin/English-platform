// Cuts a sprite sheet into equal cells and draws one cell at a time.
export function createSpriteSheet(img, { cols, rows, smooth = true }) {
  const fw = img.naturalWidth / cols;
  const fh = img.naturalHeight / rows;

  // Draws cell (col, row) centered on cx, cy, scaled to fit inside maxW x maxH.
  function draw(ctx, col, row, cx, cy, maxW, maxH) {
    const s = Math.min(maxW / fw, maxH / fh);
    const dw = fw * s;
    const dh = fh * s;
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(img, col * fw, row * fh, fw, fh, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  return { frameW: fw, frameH: fh, draw };
}


export function createAnimator({ frames, fps = 8, mode = 'loop' }) {
  const sequence = [];
  for (let i = 0; i < frames; i++) sequence.push(i);
  if (mode === 'pingpong') {
    for (let i = frames - 2; i > 0; i--) sequence.push(i);
  }

  function frameAt(time, offset = 0) {
    const step = Math.floor((time + offset) * fps);
    return sequence[mode === 'once' ? Math.min(step, sequence.length - 1) : step % sequence.length];
  }

  return { frameAt, length: sequence.length };
}