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

const CHEVRON_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

const SLIDES = [
  {
    // A real screenshot rather than a drawing of one: it carries all four
    // habit types and a day mid-progress, because the buttons are the half of
    // the app the slide is explaining. Both themes ship because a light
    // screenshot on a dark card looks like a bug.
    artClass: 'is-shot',
    art: `<img class="intro-shot intro-shot-light" src="example-month.png?v=1.8.0"
               alt="The calendar with habit icons on most days, above the habit buttons" width="390" height="560">
          <img class="intro-shot intro-shot-dark" src="example-month-dark.png?v=1.8.0"
               alt="The calendar with habit icons on most days, above the habit buttons" width="390" height="560">`,
    title: 'Tap a day, then tap what you did',
    body: 'Habit buttons stay greyed out until a day is selected.',
    tip: 'Tap a faded day to jump months. Arrow keys move, Enter selects.'
  },
  {
    art: `<div class="intro-art-name">
            <span class="intro-typed">💧 Water</span>
            <span class="intro-arrow">→</span>
            <span class="intro-chip"><span class="intro-chip-emoji good">💧</span> Water</span>
          </div>`,
    title: 'Start the name with an emoji',
    body: 'It becomes that habit’s icon on the calendar.',
    tip: 'Good, neutral and bad are one tap. Counters track a daily goal.'
  },
  {
    art: `<div class="intro-art-rows">
            <span class="intro-row"><span class="intro-grip"></span>🏃 Run</span>
            <span class="intro-row is-lifted"><span class="intro-grip"></span>💧 Water</span>
            <span class="intro-row"><span class="intro-grip"></span>🧘 Stretch</span>
          </div>`,
    title: 'Drag to reorder, tap to rename',
    body: 'Both live in settings, on the habit itself.',
    tip: 'The buttons follow this order, so put your daily ones first.'
  },
  {
    art: `<div class="intro-art-shield">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>`,
    title: 'Everything stays on this device',
    body: 'No account, no server — and clearing browser data erases it.',
    tip: 'So back it up from settings. You will be nudged after a week.'
  }
];

class Intro {
  constructor() {
    this.index = 0;
    this.root = null;
  }

  // No habits is the whole condition: an app with nothing in it has nothing to
  // show, so the slides stand in for the empty state and keep coming back
  // until there is a first habit. Adding one is what dismisses them for good,
  // which also means an existing user never sees this.
  static shouldShow(dataManager) {
    return dataManager.getHabits().length === 0;
  }

  open() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.className = 'intro';
    this.root.innerHTML = `
      <div class="intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title" tabindex="-1">
        <button class="intro-close" id="intro-close" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
        <div class="intro-art" id="intro-art"></div>
        <h2 class="intro-title" id="intro-title"></h2>
        <p class="intro-body" id="intro-body"></p>
        <p class="intro-tip" id="intro-tip"></p>
        <div class="intro-nav">
          <button class="intro-step" id="intro-back" title="Back" aria-label="Back">${CHEVRON_LEFT}</button>
          <div class="intro-dots" id="intro-dots"></div>
          <button class="intro-step" id="intro-next" title="Next" aria-label="Next">${CHEVRON_RIGHT}</button>
        </div>
      </div>`;

    document.body.appendChild(this.root);

    this.root.querySelector('#intro-close').onclick = () => this.close();
    this.root.querySelector('#intro-back').onclick = () => this.previous();
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

    const art = this.root.querySelector('#intro-art');
    art.className = 'intro-art' + (slide.artClass ? ' ' + slide.artClass : '');
    art.innerHTML = slide.art;
    this.root.querySelector('#intro-title').textContent = slide.title;
    this.root.querySelector('#intro-body').textContent = slide.body;
    this.root.querySelector('#intro-tip').textContent = slide.tip;
    // Back is kept in place rather than removed on the first slide, so the
    // dots do not jump sideways as the pair of arrows appears and disappears
    const back = this.root.querySelector('#intro-back');
    back.disabled = this.index === 0;

    // The last slide's forward arrow becomes the way out, and says so
    const next = this.root.querySelector('#intro-next');
    next.classList.toggle('is-done', last);
    next.innerHTML = last ? 'Get started' : CHEVRON_RIGHT;
    next.title = last ? 'Get started' : 'Next';
    next.setAttribute('aria-label', next.title);

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
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (this.onClose) this.onClose();
  }
}
