(function (root) {
  'use strict';
  const key = 'gastos_theme_v1';
  let theme = 'dark';
  try { if (localStorage.getItem(key) === 'light') theme = 'light'; } catch {}
  function apply(value, switching = false) {
    if (switching) {
      document.documentElement.classList.add('theme-changing');
      // Apply the transition guard before changing foreground/background tokens.
      document.documentElement.getBoundingClientRect();
    }
    theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1120' : '#F3F5F9');
    if (switching) {
      document.documentElement.getBoundingClientRect();
      requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-changing')));
    }
  }
  apply(theme);
  root.GastosTheme = Object.freeze({
    current: () => theme,
    set(value) {
      apply(value, true);
      try { localStorage.setItem(key, theme); } catch {}
      root.dispatchEvent(new CustomEvent('gastos:themechange'));
    }
  });
  root.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { apply(event.newValue, true); root.dispatchEvent(new CustomEvent('gastos:themechange')); }
  });
})(window);
