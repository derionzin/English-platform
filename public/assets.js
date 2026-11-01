const Assets = (() => {
  const images = {};
  const buffers = {};
  let ctx = null;
  let master = null;
  let music = null;
  let muted = false;
  try { muted = localStorage.getItem('gameMuted') === '1'; } catch {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function loadSound(src) {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const data = await res.arrayBuffer();
      const c = audio();
      if (!c) return null;
      return await new Promise((ok, fail) => c.decodeAudioData(data, ok, fail));
    } catch {
      return null;
    }
  }

  async function load(manifest = {}, onProgress = () => {}) {
    const jobs = [];
    for (const [name, src] of Object.entries(manifest.images || {})) {
      if (src) jobs.push({ kind: 'image', name, src });
    }
    for (const [name, src] of Object.entries(manifest.sounds || {})) {
      if (src) jobs.push({ kind: 'sound', name, src });
    }

    const total = jobs.length;
    const failed = [];
    let done = 0;
    onProgress(0, total);

    await Promise.all(
      jobs.map(async (job) => {
        const result = job.kind === 'image' ? await loadImage(job.src) : await loadSound(job.src);
        if (!result) failed.push(job.src);
        else if (job.kind === 'image') images[job.name] = result;
        else buffers[job.name] = result;
        done++;
        onProgress(done, total);
      })
    );

    if (failed.length) console.warn('Could not load these files:', failed);
    return { total, failed };
  }

  const image = (name) => images[name] || null;

  function unlock() {
    const c = audio();
    if (c && c.state === 'suspended') c.resume();
  }

  function play(name, { volume = 1, rate = 1 } = {}) {
    const buffer = buffers[name];
    if (!buffer || muted || !audio()) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
  }

  function stopMusic() {
    if (music) {
      try { music.stop(); } catch {}
      music = null;
    }
  }

  function playMusic(name, volume = 0.4) {
    stopMusic();
    const buffer = buffers[name];
    if (!buffer || !audio()) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
    music = source;
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem('gameMuted', value ? '1' : '0'); } catch {}
    if (master) master.gain.value = value ? 0 : 1;
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if