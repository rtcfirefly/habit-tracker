// How the app is drawn, which is a different question from light or dark.
//
// Cards is what the app has always looked like: every day a white plate with a
// border and a shadow, every habit stating its type with a 2px coloured border.
// Ruled takes the plates away - the month becomes one sheet, the pills a
// hairline and a fill - and is quieter to read at a glance.
//
// Both ship because they are a taste, not a correctness question, and the two
// combine with light and dark rather than replacing them.

const LOOK_KEY = 'look';
const LOOKS = ['cards', 'ruled'];

class LookManager {
  constructor(root) {
    this.root = root;
    this.look = LookManager.load();
    this.apply();
  }

  static get looks() {
    return LOOKS.slice();
  }

  // Cards is the default, because it is what an existing user already has on
  // screen. Nobody should open the app after an update and find it redrawn.
  static load() {
    const stored = localStorage.getItem(LOOK_KEY);
    return LOOKS.includes(stored) ? stored : 'cards';
  }

  static isLook(value) {
    return LOOKS.includes(value);
  }

  set(look) {
    if (!LookManager.isLook(look) || look === this.look) return;
    this.look = look;
    localStorage.setItem(LOOK_KEY, look);
    this.apply();
    if (this.onChanged) this.onChanged(look);
  }

  apply() {
    // On the root as well as the body: the head script paints the ground before
    // the body exists, the same way the theme does
    LOOKS.forEach(look => {
      const on = look === this.look;
      document.body.classList.toggle(`look-${look}`, on);
      document.documentElement.classList.toggle(`look-${look}`, on);
    });

    if (!this.root) return;
    this.root.querySelectorAll('[data-look]').forEach(button => {
      const on = button.dataset.look === this.look;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  wire() {
    if (!this.root) return;
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-look]');
      if (button) this.set(button.dataset.look);
    });
  }
}
