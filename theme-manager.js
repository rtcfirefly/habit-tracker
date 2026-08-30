// Must match the body background in styles.css for each theme
const THEME_COLORS = { light: '#f5f5f5', dark: '#1e1e1e' };

const MODE_KEY = 'themeMode';
const LEGACY_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// system is the default and the first stop in the cycle, so an appearance
// nobody has touched is the one the phone is already using
const MODES = ['system', 'light', 'dark'];

const MODE_TITLES = {
  system: 'Appearance: matching the system — tap for light',
  light: 'Appearance: light — tap for dark',
  dark: 'Appearance: dark — tap to match the system'
};

class ThemeManager {
  constructor(toggleButtonElement) {
    this.toggleButtonElement = toggleButtonElement;
    this.mode = ThemeManager.loadMode();

    // The system can change under a running app - a phone on a dark-at-sunset
    // schedule does it nightly - and while the mode is system, following it
    // means following it then too, not only at load
    this.media = window.matchMedia ? window.matchMedia(DARK_QUERY) : null;
    if (this.media) {
      this.media.addEventListener('change', () => {
        if (this.mode === 'system') this.apply();
      });
    }

    this.setupToggleHandler();
    this.apply();
  }

  // The old key was written on every load, not only when someone chose
  // something, so a stored 'light' cannot be told apart from never having
  // touched it - and 'light' was the default that got written. 'dark' could
  // only ever have come from a tap, so that one is a real preference and is
  // kept; anything else starts out following the system.
  static migrate(legacy) {
    return legacy === 'dark' ? 'dark' : 'system';
  }

  static loadMode() {
    const stored = localStorage.getItem(MODE_KEY);
    if (MODES.includes(stored)) return stored;
    return ThemeManager.migrate(localStorage.getItem(LEGACY_KEY));
  }

  static resolve(mode, systemPrefersDark) {
    if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
    return mode;
  }

  static nextMode(mode) {
    return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  }

  get systemPrefersDark() {
    return this.media ? this.media.matches : false;
  }

  get theme() {
    return ThemeManager.resolve(this.mode, this.systemPrefersDark);
  }

  apply() {
    const isDark = this.theme === 'dark';

    document.body.classList.toggle('dark-mode', isDark);
    // The head script marks the root element before first paint. Keeping it in
    // step matters on the way back: an html left dark under a light body shows
    // through anywhere the body is shorter than the viewport.
    document.documentElement.classList.toggle('dark-mode', isDark);
    // The button shows which of the three it is on, so a mode that resolves to
    // the same colours as the next one is still legible
    MODES.forEach(m => document.body.classList.toggle(`mode-${m}`, m === this.mode));

    this.toggleButtonElement.title = MODE_TITLES[this.mode];
    this.toggleButtonElement.setAttribute('aria-label', MODE_TITLES[this.mode]);
    this.applyStatusBarColor(isDark);

    localStorage.setItem(MODE_KEY, this.mode);
    // Nothing reads it any more, and leaving it would quietly re-migrate on a
    // browser that had its new key cleared
    localStorage.removeItem(LEGACY_KEY);
  }

  // Installed as a PWA the phone tints its status bar with this, so leaving it
  // on the manifest's single fixed colour left a bright bar above a dark app
  applyStatusBarColor(isDark) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? THEME_COLORS.dark : THEME_COLORS.light);
    }
  }

  toggleTheme() {
    this.mode = ThemeManager.nextMode(this.mode);
    this.apply();
  }

  setupToggleHandler() {
    this.toggleButtonElement.onclick = () => {
      this.toggleTheme();
    };
  }
}
