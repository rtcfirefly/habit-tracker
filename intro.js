// First-run explainer.
//
// Four slides, shown once. Everything here is a feature that exists but does
// not announce itself: the calendar gates every habit button until a day is
// picked, the emoji in a habit's name becomes its icon, and the settings
// dialog hides drag-to-reorder and tap-to-rename behind gestures with no
// affordance. Someone landing on this app cold taps a habit, nothing happens,
// and they leave.
//
// The slides are built in JS rather than sitting in index.html because they
// are read once and then never again - there is no reason to ship them into
// the DOM of every later visit.

const SEEN_KEY = 'introSeen';

const SLIDES = [
  {
    art: `<div class="intro-art-calendar">
            <span class="intro-day">10</span>
            <span class="intro-day is-today">11</span>
            <span class="intro-day is-selected">12<span class="intro-tap"></span></span>
            <span class="intro-day">13</span>
          </div>`,
    title: 'Pick a day first',
    body: 'Habit buttons stay greyed out until you tap a day on the calendar. '
        + 'Tap one, then tap what you did — that is the whole loop.',
    tip: 'Tap a faded day from a neighbouring month to jump to that month. '
       + 'Arrow keys move between days, Enter selects.'
  },
  {
    art: `<div class="intro-art-name">
            <span class="intro-typed">💧 Water</span>
            <span class="intro-arrow">→</span>
            <span class="intro-chip"><span class="intro-chip-emoji good">💧</span> Water</span>
          </div>`,
    title: 'The emoji is the icon',
    body: 'Start a habit name with an emoji and it becomes that habit’s icon '
        + 'on the calendar. The rest of the name stays as the label.',
    tip: 'Four kinds: good, neutral and bad are a yes/no tap. A counter '
       + 'habit gets a daily goal and − / + buttons, like 6/8 glasses.'
  },
  {
    art: `<div class="intro-art-rows">
            <span class="intro-row"><span class="intro-grip"></span>🏃 Run</span>
            <span class="intro-row is-lifted"><span class="intro-grip"></span>💧 Water</span>
            <span class="intro-row"><span class="intro-grip"></span>🧘 Stretch</span>
          </div>`,
    title: 'Reorder and rename',
    body: 'In settings, drag a habit by its handle to reorder it, or tap its '
        + 'name to rename it in place.',
    tip: 'The order you set is the order the buttons appear in, so put the '
       + 'ones you tap daily first.'
  },
  {
    art: `<div class="intro-art-shield">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>`,
    title: 'Your data stays on your device',
    body: 'Nothing is sent anywhere — there is no account and no server. '
        + 'That also means clearing your browser data erases it.',
    tip: 'So back it up: settings can export a file, or write every change '
       + 'straight to a file in your cloud drive. You will get a nudge if a '
       + 'week goes by without one.'
  }
];

class Intro {
  static get seen() {
    return localStorage.getItem(SEEN_KEY) === '1';
  }

  static markSeen() {
    localStorage.setItem(SEEN_KEY, '1');
  }

  constructor() {
    this.index = 0;
    this.root = null;
  }

  // Shown only to someone with no habits and no history. An existing user
  // arriving on a new version has already worked all of this out the hard way
  // and does not need it in their face.
  static shouldShow(dataManager) {
    if (Intro.seen) return false;
    return dataManager.getHabits().length === 0;
  }

  open() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.className = 'intro';
    this.root.innerHTML = `
      <div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title" tabindex="-1">
        <div class="intro-art" id="intro-art"></div>
        <h2 class="intro-title" id="intro-title"></h2>
        <p class="intro-body" id="intro-body"></p>
        <p class="intro-tip" id="intro-tip"></p>
        <div class="intro-nav">
          <button class="intro-skip" id="intro-skip">Skip</button>
          <div class="intro-dots" id="intro-dots"></div>
          <button class="intro-next" id="intro-next"></button>
        </div>
      </div>`;

    document.body.appendChild(this.root);

    this.root.querySelector('#intro-skip').onclick = () => this.close();
    this.root.querySelector('#intro-next').onclick = () => this.next();

    // Arrow keys read as the obvious thing on a slideshow, and Escape has to
    // work or the overlay is a trap
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
      else if (event.key === 'ArrowRight') this.next();
      else if (event.key === 'ArrowLeft') this.previous();
    });

    this.render();
    this.root.querySelector('.intro-card').focus();
  }

  render() {
    const slide = SLIDES[this.index];
    const last = this.index === SLIDES.length - 1;

    this.root.querySelector('#intro-art').innerHTML = slide.art;
    this.root.querySelector('#intro-title').textContent = slide.title;
    this.root.querySelector('#intro-body').textContent = slide.body;
    this.root.querySelector('#intro-tip').textContent = slide.tip;
    this.root.querySelector('#intro-next').textContent = last ? 'Get started' : 'Next';
    this.root.querySelector('#intro-skip').style.visibility = last ? 'hidden' : '';

    const dots = this.root.querySelector('#intro-dots');
    dots.textContent = '';
    SLIDES.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'intro-dot' + (i === this.index ? ' is-current' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1} of ${SLIDES.length}`);
      dot.onclick = () => { this.index = i; this.render(); };
      dots.appendChild(dot);
    });
  }

  next() {
    if (this.index === SLIDES.length - 1) this.close();
    else { this.index++; this.render(); }
  }

  previous() {
    if (this.index > 0) { this.index--; this.render(); }
  }

  close() {
    Intro.markSeen();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (this.onClose) this.onClose();
  }
}
