(function () {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try { return localStorage.getItem('theme'); } catch { return null; }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      btn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
    }
  }

  apply(saved() || (media.matches ? 'dark' : 'light'));

  media.addEventListener('change', (e) => {
    if (!saved()) apply(e.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.type = 'button';
    btn.onclick = () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch {}
      apply(next);
    };
    document.body.append(btn);
    apply(root.dataset.theme);
  });
})();