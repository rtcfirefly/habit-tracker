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

    this.currentTheme = theme;
    this.saveTheme(theme);
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