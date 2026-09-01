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
const CHEVRON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

// A settings row, built from the app's own markup and classes so the guide
// shows the thing itself rather than a drawing of it that goes stale
function row(emoji, name, extra = '', editing = false) {
  const middle = editing
    ? `<input class="habit-name-edit" value="${emoji} ${name}" size="1" readonly tabindex="-1" aria-hidden="true">`
    : `<div class="habit-name-display"><span class="habit-emoji good">${emoji}</span> ${name}</div>`;
  return `<div class="manage-item good ${extra}">
            <div class="manage-item-content">
              <div class="drag-handle">⠿</div>
              ${middle}
              <div class="habit-controls"><button class="delete-btn" tabindex="-1">×</button></div>
            </div>
          </div>`;
}

const SLIDES = [
  {
    // A real screenshot rather than a drawing of one: it carries all four
    // habit types and a day mid-progress, because the buttons are the half of
    // the app the slide is explaining. Both themes ship because a light
    // screenshot on a dark card looks like a bug.
    artClass: 'is-shot',
    art: `<img class="intro-pic intro-pic-light" src="example-month.png?v=2.6.1"
               alt="The calendar with habit icons on most days, above the habit buttons" width="390" height="560">
          <img class="intro-pic intro-pic-dark" src="example-month-dark.png?v=2.6.1"
               alt="The calendar with habit icons on most days, above the habit buttons" width="390" height="560">`,
    title: 'Tap a day, then tap what you did',
    body: 'The icons on a day are what you logged against it.'
  },
  {
    // Three kinds, one of which is counted, rather than four kinds one of
    // which is a counter. The chips carry it: same three shapes, and the one
    // with a number on it is a good habit like the one above it.
    art: `<div class="intro-art-chips">
            <span class="intro-chip good"><span class="intro-chip-emoji good">💧</span> Water</span>
            <span class="intro-chip neutral"><span class="intro-chip-emoji neutral">☕</span> Coffee</span>
            <span class="intro-chip bad"><span class="intro-chip-emoji bad">🚬</span> Smoke</span>
            <span class="intro-chip good"><span class="intro-chip-emoji good">📖</span> Read pages
              <span class="intro-chip-count">12<span class="intro-chip-goal">/30</span></span>
            </span>
          </div>`,
    title: 'Good, bad, or neutral',
    body: 'Any of them can count instead of being a single tap.'
  },
  {
    // The gear, because "in settings" is not much use to someone who has not
    // worked out that the one button in the header is a button
    artClass: 'is-strip',
    art: `<img class="intro-pic intro-pic-light" src="example-gear.png?v=2.6.1"
               alt="The Manage Habits button in the top right of the header" width="390" height="64">
          <img class="intro-pic intro-pic-dark" src="example-gear-dark.png?v=2.6.1"
               alt="The Manage Habits button in the top right of the header" width="390" height="64">`,
    title: 'The gear opens Manage Habits',
    body: 'Add, rename and reorder your habits from there.'
  },
  {
    // The app's own rows, like the rename slide next door. These two describe
    // the same list in the same dialog and were drawing it two different ways
    // - and the old drawing's grip was a faint CSS gradient, the least visible
    // thing on a slide about grabbing the grip.
    art: `<div class="intro-art-list">
            ${row('🏃', 'Run')}
            ${row('💧', 'Water', 'is-dragged')}
            ${row('🧘', 'Stretch')}
          </div>`,
    title: 'Drag the grip to reorder',
    body: 'Habit buttons appear in this order, so put the ones you tap most on top.'
  },
  {
    // The app's own manage-item markup, classes and all, rather than a
    // drawing of one. The row is what someone is looking at when they need
    // this, and the point is which part of it takes the tap - so it has to be
    // the whole row, twice, not a name and a box floating on their own. The
    // emoji stays in the field because it is part of the name being edited.
    art: `<div class="intro-art-list">
            ${row('💧', 'Water')}
            <span class="intro-down">${CHEVRON_DOWN}</span>
            ${row('💧', 'Water', '', true)}
          </div>`,
    title: 'Tap a name to change it',
    body: 'It turns into a text box you can edit.'
  },
  {
    // The three controls drawn and labelled, rather than a screenshot of the
    // whole dialog with a ring round the corner it lives in. A ring says
    // where; it does not say which button does what, and that was the part
    // people were being left to guess.
    art: `<div class="intro-art-backup">
            <span class="intro-bk-panel"></span>
            <span class="intro-bk-ctl c1 is-button">Choose file</span>
            <span class="intro-bk-ctl c2">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </span>
            <span class="intro-bk-ctl c3">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </span>
            <span class="intro-bk-line c1"></span>
            <span class="intro-bk-line c2"></span>
            <span class="intro-bk-line c3"></span>
            <span class="intro-bk-label c1">Kept up to date</span>
            <span class="intro-bk-label c2">Export</span>
            <span class="intro-bk-label c3">Import</span>
          </div>`,
    title: 'Everything stays on this device',
    body: 'Nothing is uploaded anywhere, so keep a backup of your own.'
  }
];

class Intro {
  constructor() {
    this.index = 0;
    this.root = null;
  }

  static get slides() {
    return SLIDES;
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
        <div class="intro-content">
          <div class="intro-art" id="intro-art"></div>
          <h2 class="intro-title" id="intro-title"></h2>
          <p class="intro-body" id="intro-body"></p>
        </div>
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

    // Back leaves the guide, not the app
    this.backClose = () => this.close(false);
    BackTrap.push(this.backClose);

    this.render();
    this.root.querySelector('.intro-card').focus();
  }

  render() {
    const slide = SLIDES[this.index];
    const last = this.index === SLIDES.length - 1;

    const art = this.root.querySelector('#intro-art');
    art.className = 'intro-art' + (slide.artClass ? ' ' + slide.artClass : '');
    art.innerHTML = slide.art;

    // Choosing a file needs the File System Access API, and script.js hides
    // that row outright where it is missing - most notably on iOS, which is
    // exactly the phone this deck is drawn for. Pointing a labelled arrow at a
    // control the reader does not have is worse than not mentioning it.
    if (typeof FileBackup !== 'undefined' && !FileBackup.supported) {
      const backup = art.querySelector('.intro-art-backup');
      if (backup) {
        backup.querySelectorAll('.c1').forEach(el => el.remove());
        // A class, not an inline grid-template. The remaining items name
        // columns 2 and 3 explicitly, so narrowing the template alone left
        // them in 2 and 3 - and grid invented an implicit third column,
        // leaving column one as a hole where the removed control had been.
        backup.classList.add('is-two');
      }
    }
    this.root.querySelector('#intro-title').textContent = slide.title;
    this.root.querySelector('#intro-body').textContent = slide.body;
    // Back is kept in place rather than removed on the first slide, so the
    // dots do not jump sideways as the pair of arrows appears and disappears
    const back = this.root.querySelector('#intro-back');
    back.disabled = this.index === 0;

    // The last slide's forward arrow becomes the way out, and says so
    const next = this.root.querySelector('#intro-next');
    next.classList.toggle('is-done', last);
    next.innerHTML = last ? 'Done' : CHEVRON_RIGHT;
    next.title = last ? 'Done' : 'Next';
    next.setAttribute('aria-label', next.title);

    const dots = this.root.querySelector('#intro-dots');
    dots.textContent = '';
    SLIDES.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'intro-dot' + (i === this.index ? ' is-current' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1} of ${SLIDES.length}`);
      // Without this a screen reader hears six identically named buttons and
      // no way to tell which one it is on
      if (i === this.index) dot.setAttribute('aria-current', 'true');
      dot.onclick = () => { this.index = i; this.render(); };
      dots.appendChild(dot);
    });
  }

  next() {
    if (this.index === SLIDES.length - 1) this.close(true);
    else { this.index++; this.render(); }
  }

  previous() {
    if (this.index > 0) { this.index--; this.render(); }
  }

  // finished is false when the reader closed the deck rather than reaching the
  // end of it. What follows is a prompt to tap the gear, and pushing that at
  // someone who just dismissed the guide would be reading the X backwards.
  close(finished = false) {
    if (this.root) {
      this.root.remove();
      this.root = null;
      BackTrap.remove(this.backClose);
    }
    if (this.onClose) this.onClose(finished);
  }
}


// Dims the app and leaves one control lit, so the last step of the guide is
// the reader doing the thing rather than reading about it. The gear is the
// only way into an empty app, and tapping it once is what teaches it.
class Spotlight {
  // anchor is what the hint hangs off - the header for the gear, the calendar
  // for a day - and placement decides which way it points. Both default to the
  // gear's arrangement, which was the only one when this was written.
  constructor(target, { text, anchor, placement = 'under-right', dim = 'is-spotlighting' } = {}) {
    this.target = target;
    this.text = text || 'Tap the gear to add your first habit';
    this.anchor = anchor || (target && target.parentNode);
    this.placement = placement;
    this.dim = dim;
    this.root = null;
    this.hint = null;
  }

  show() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.className = 'spotlight';
    document.body.appendChild(this.root);

    // The hint hangs off the header rather than being placed in pixels. An
    // earlier version measured the gear with getBoundingClientRect, which is
    // read at whatever width the window happens to be at the time - fine in a
    // browser, wrong in every screenshot, and wrong again on a rotate.
    this.hint = document.createElement('div');
    this.hint.className = `spotlight-hint is-${this.placement}`;
    this.hint.innerHTML = `
      <p class="spotlight-text">${this.text}</p>
      <button class="spotlight-skip" id="spotlight-skip">Not now</button>`;
    this.anchor.appendChild(this.hint);

    this.hint.querySelector('#spotlight-skip').onclick = () => this.hide();

    // The dimmed area swallows taps: the point is that one control works
    this.root.onclick = () => this.pulse();

    this.onTargetClick = () => this.hide();
    this.target.addEventListener('click', this.onTargetClick);

    document.addEventListener('keydown', this.onKeydown = (event) => {
      if (event.key === 'Escape') this.hide();
    });

    this.target.classList.add('is-spotlit');
    document.body.classList.add(this.dim);

    this.backClose = () => this.hide();
    BackTrap.push(this.backClose);
  }

  pulse() {
    this.target.classList.remove('is-pulsing');
    // Reading offsetWidth restarts the animation; without it a second tap on
    // the dimmed area does nothing at all
    void this.target.offsetWidth;
    this.target.classList.add('is-pulsing');
  }

  hide() {
    if (!this.root) return;
    this.target.classList.remove('is-spotlit', 'is-pulsing');
    document.body.classList.remove(this.dim);
    this.target.removeEventListener('click', this.onTargetClick);
    document.removeEventListener('keydown', this.onKeydown);
    this.hint.remove();
    this.root.remove();
    this.root = null;
    this.hint = null;
    BackTrap.remove(this.backClose);
  }
}
