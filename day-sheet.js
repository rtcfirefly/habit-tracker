// The editor for one day.
//
// Habit buttons under the calendar only go up: a counter is a single tap that
// adds one, which keeps the main screen the same shape as every other habit.
// Everything that needs two directions - correcting a count, ticking something
// off days later, undoing a mis-tap - happens here instead.
//
// Reached by tapping a day that is already selected. That is deliberately not a
// new gesture: the first tap selects, the second opens this.

class DaySheet {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.root = null;
    this.dateKey = null;
  }

  static title(dateKey) {
    const date = new Date(dateKey);
    return date.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  open(dateKey) {
    this.close();
    this.dateKey = dateKey;

    this.root = document.createElement('div');
    this.root.className = 'day-sheet';
    this.root.innerHTML = `
      <div class="day-sheet-card" role="dialog" aria-modal="true" aria-labelledby="day-sheet-title" tabindex="-1">
        <div class="day-sheet-head">
          <h2 class="day-sheet-title" id="day-sheet-title">${DaySheet.title(dateKey)}</h2>
          <button class="day-sheet-close" id="day-sheet-close" title="Close" aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>
        <div class="day-sheet-list" id="day-sheet-list"></div>
        <button class="day-sheet-done" id="day-sheet-done">Done</button>
      </div>`;

    document.body.appendChild(this.root);

    this.root.querySelector('#day-sheet-done').onclick = () => this.close();
    this.root.querySelector('#day-sheet-close').onclick = () => this.close();

    // Back closes the sheet rather than the app
    this.backClose = () => this.close();
    BackTrap.push(this.backClose);
    // Tapping the dark around it is the other way out, as with the habit dialog
    this.root.onclick = (event) => {
      if (event.target === this.root) this.close();
    };
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });

    this.render();
    this.root.querySelector('.day-sheet-card').focus();
  }

  render() {
    const list = this.root.querySelector('#day-sheet-list');
    list.textContent = '';

    const habits = this.dataManager.getHabits();
    if (!habits.length) {
      const empty = document.createElement('p');
      empty.className = 'day-sheet-empty';
      empty.textContent = 'No habits yet.';
      list.appendChild(empty);
      return;
    }

    // The same order as the buttons under the calendar, from the same function,
    // so the two lists cannot drift apart
    DataManager.inDisplayOrder(habits).forEach(habit => list.appendChild(
      DataManager.isCounted(habit) ? this.counterRow(habit) : this.toggleRow(habit)
    ));
  }

  // percent fills the row the way it fills a habit button: a plain habit is
  // all or nothing, a counter is however far it got
  row(habit, percent) {
    const row = document.createElement('div');
    row.style.setProperty('--pct', `${percent}%`);
    // is-good rather than good: the stylesheet carries bare `.good { background:
    // green }` rules that paint any element wearing the type class, which
    // turned every row in here into a solid colour block
    row.className = `day-sheet-row is-${habit.type}`;

    const emoji = EmojiUtils.extractEmoji(habit.name);
    if (emoji) {
      const chip = document.createElement('span');
      chip.className = `habit-emoji ${habit.type}`;
      chip.textContent = emoji;
      row.appendChild(chip);
    }

    const name = document.createElement('span');
    name.className = 'day-sheet-name';
    name.textContent = EmojiUtils.removeEmoji(habit.name) || habit.name;
    row.appendChild(name);

    return row;
  }

  // No tick. The fill says whether it happened, exactly as it does on the
  // button under the calendar, and the whole row is the control - a checkbox
  // beside a row that was already tappable was two ways to say one thing.
  toggleRow(habit) {
    const done = this.dataManager.isHabitCompleted(this.dateKey, habit.name);
    const row = this.row(habit, done ? 100 : 0);

    row.classList.add('is-toggle');
    if (done) row.classList.add('completed');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-pressed', String(done));
    row.title = done ? `Undo ${habit.name}` : `Mark ${habit.name} done`;

    const toggle = () => {
      this.dataManager.toggleHabitCompletion(this.dateKey, habit.name);
      this.changed();
    };

    row.onclick = toggle;
    row.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    };

    return row;
  }

  counterRow(habit) {
    const value = this.dataManager.getCounterValue(this.dateKey, habit.name);
    const row = this.row(habit, DataManager.hasTarget(habit)
      ? DataManager.progressPercent(value, habit.goal)
      : 0);
    if (DataManager.countState(habit, value) === 'over') row.classList.add('over-limit');

    const minus = document.createElement('button');
    minus.className = 'day-sheet-step minus';
    minus.textContent = '−';
    minus.title = `One less ${habit.name}`;
    minus.disabled = value <= 0;
    minus.onclick = () => {
      this.dataManager.decrementCounter(this.dateKey, habit.name);
      this.changed();
    };

    const count = document.createElement('span');
    count.className = 'day-sheet-count';
    count.textContent = DataManager.hasTarget(habit)
      ? (DataManager.direction(habit.type) === 'limit' ? `${value} of ${habit.goal}` : `${value}/${habit.goal}`)
      : `${value}`;

    const plus = document.createElement('button');
    plus.className = 'day-sheet-step plus';
    plus.textContent = '+';
    plus.title = `One more ${habit.name}`;
    plus.onclick = () => {
      this.dataManager.incrementCounter(this.dateKey, habit.name);
      this.changed();
    };

    row.appendChild(minus);
    row.appendChild(count);
    row.appendChild(plus);
    return row;
  }

  // The sheet redraws itself and tells the app to redraw behind it, so the
  // calendar and the buttons under it are never a tap out of date
  changed() {
    this.render();
    if (this.onChanged) this.onChanged();
  }

  close() {
    if (!this.root) return;

    this.root.remove();
    this.root = null;
    this.dateKey = null;
    BackTrap.remove(this.backClose);
  }
}
