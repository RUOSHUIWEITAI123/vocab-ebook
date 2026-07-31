/**
 * Settings — theme switching and font size controls.
 */

const STORAGE_KEY = 'vocab-ebook-settings';
const MIN_FONT = 14;
const MAX_FONT = 24;
const DEFAULT_FONT = 18;

let currentFontSize = DEFAULT_FONT;
let currentTheme = 'light';

export function initSettings() {
  // Load saved settings
  loadSettings();

  // Apply initial
  applyTheme(currentTheme);
  applyFontSize(currentFontSize);

  // Toolbar controls
  document.getElementById('font-minus').addEventListener('click', () => {
    changeFontSize(-1);
  });
  document.getElementById('font-plus').addEventListener('click', () => {
    changeFontSize(1);
  });

  // Theme toggle button (cycles through themes)
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const themes = ['light', 'sepia', 'dark'];
    const idx = themes.indexOf(currentTheme);
    const next = themes[(idx + 1) % themes.length];
    setTheme(next);
  });

  // Settings panel
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-overlay').addEventListener('click', closeSettings);

  // Settings panel font controls
  document.getElementById('settings-font-minus').addEventListener('click', () => changeFontSize(-1));
  document.getElementById('settings-font-plus').addEventListener('click', () => changeFontSize(1));

  // Settings panel theme options
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
    });
  });

  // ESC to close settings
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
    }
  });
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      if (saved.theme) currentTheme = saved.theme;
      if (saved.fontSize) currentFontSize = saved.fontSize;
    }
  } catch (e) {
    // Ignore
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    theme: currentTheme,
    fontSize: currentFontSize,
  }));
}

function setTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Update theme options in settings panel
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  // Update theme toggle icon
  const icons = { light: '☀️', sepia: '📜', dark: '🌙' };
  document.getElementById('theme-toggle').textContent = icons[theme] || '🌓';

  saveSettings();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function changeFontSize(delta) {
  currentFontSize = Math.max(MIN_FONT, Math.min(MAX_FONT, currentFontSize + delta));
  applyFontSize(currentFontSize);
  saveSettings();
}

function applyFontSize(size) {
  document.documentElement.style.setProperty('--font-size', size + 'px');
  document.getElementById('settings-font-size').textContent = size + 'px';
}

function openSettings() {
  document.getElementById('settings-panel').classList.add('visible');
  document.getElementById('settings-overlay').classList.add('visible');
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function closeSettings() {
  document.getElementById('settings-panel').classList.remove('visible');
  document.getElementById('settings-overlay').classList.remove('visible');
}
