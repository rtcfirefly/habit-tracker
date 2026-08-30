// Must match the body background in styles.css for each theme
const THEME_COLORS = { light: '#f5f5f5', dark: '#1e1e1e' };

class ThemeManager {
  constructor(toggleButtonElement) {
    this.toggleButtonElement = toggleButtonElement;
    this.currentTheme = this.loadSavedTheme();
    
    this.setupToggleHandler();
    this.applyTheme(this.currentTheme);
  }

  loadSavedTheme() {
    return localStorage.getItem('theme') || 'light';
  }

  saveTheme(theme) {
    localStorage.setItem('theme', theme);
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';

    // The toggle shows both a moon/sun and a Light/Dark label; both pairs are in
    // the markup and CSS picks one off this class, so nothing here rewrites the
    // button's contents.
    document.body.classList.toggle('dark-mode', isDark);
    this.toggleButtonElement.setAttribute('aria-pressed', String(isDark));
    this.applyStatusBarColor(isDark);

    this.currentTheme = theme;
    this.saveTheme(theme);
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
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  setupToggleHandler() {
    this.toggleButtonElement.onclick = () => {
      this.toggleTheme();
    };
  }
}