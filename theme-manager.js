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
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      this.toggleButtonElement.innerText = '☀️';
    } else {
      document.body.classList.remove('dark-mode');
      this.toggleButtonElement.innerText = '🌙';
    }
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