class HabitsView {
  constructor(habitsListElement, dataManager) {
    this.habitsListElement = habitsListElement;
    this.dataManager = dataManager;
    this.selectedDate = null;
    this.onHabitToggled = null;
  }

  setSelectedDate(dateKey) {
    this.selectedDate = dateKey;
  }


  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }


  createHabitButton(habit) {
    if (DataManager.isCounted(habit)) {
      return this.createCounterHabit(habit);
    }
    
    const button = document.createElement('button');
    button.className = `habit-button ${habit.type}`;
    button.disabled = !this.selectedDate;
    
    const emoji = EmojiUtils.extractEmoji(habit.name);
    if (emoji) {
      // Create emoji circle
      const emojiSpan = document.createElement('span');
      emojiSpan.className = `habit-emoji ${habit.type}`;
      emojiSpan.textContent = emoji;
      emojiSpan.title = habit.name;
      
      // Create text without emoji
      const textWithoutEmoji = habit.name.replace(emoji, '').trim();
      
      button.appendChild(emojiSpan);
      if (textWithoutEmoji) {
        button.appendChild(document.createTextNode(' ' + textWithoutEmoji));
      }
    } else {
      button.textContent = habit.name;
    }

    if (this.selectedDate && this.dataManager.isHabitCompleted(this.selectedDate, habit.name)) {
      button.classList.add('completed');
    }

    button.addEventListener('click', () => {
      if (!this.selectedDate) return;
      
      this.dataManager.toggleHabitCompletion(this.selectedDate, habit.name);
      
      if (this.onHabitToggled) {
        this.onHabitToggled();
      }
      
      this.render();
    });

    return button;
  }

  // One control, one direction. A counter is the same shape as every other
  // habit button - tap it and it goes up by one - and the two-way editing
  // lives in the day sheet, reached by tapping the day again. A pair of small
  // round buttons on every counter row was most of the width of the row and
  // the only place in the app where a habit was not just a button.
  // A counted habit is two controls in one pill: tap the left half to add one,
  // tap the number to type it. Thirty pages was thirty taps otherwise, and the
  // only way down was a separate sheet.
  //
  // A wrapper holding two sibling buttons, not a button inside a button - the
  // parser hoists a nested button straight out of its parent. The wrapper keeps
  // the pill's border and radius; the left half keeps the padding, so it still
  // sets the height and the pill does not grow.
  createCounterHabit(habit) {
    const pill = document.createElement('div');
    pill.className = `habit-counter ${habit.type}`;

    const value = this.selectedDate
      ? this.dataManager.getCounterValue(this.selectedDate, habit.name)
      : 0;
    const state = DataManager.countState(habit, value);
    // A tally has nothing to fill toward, so it does not fill
    const progress = DataManager.hasTarget(habit)
      ? DataManager.progressPercent(value, habit.goal)
      : 0;

    if (state === 'done') pill.classList.add('completed');
    if (state === 'over') pill.classList.add('over-limit');
    // A tally has no target, so there is no proportion to fill toward - but a
    // habit you have counted three times is not a habit you have not touched,
    // and an empty pill said it was
    if (state === 'counting') pill.classList.add('counting');
    if (DataManager.hasTarget(habit)) pill.classList.add('has-target');

    const add = document.createElement('button');
    add.className = 'counter-add';
    add.disabled = !this.selectedDate;
    add.style.setProperty('--pct', `${progress}%`);

    const emoji = EmojiUtils.extractEmoji(habit.name);
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = `habit-emoji ${habit.type} filling`;
      emojiSpan.style.setProperty('--pct', `${progress}%`);
      emojiSpan.textContent = emoji;
      add.appendChild(emojiSpan);

      const rest = EmojiUtils.removeEmoji(habit.name);
      if (rest) {
        const label = document.createElement('span');
        label.className = 'counter-name';
        label.textContent = rest;
        add.appendChild(label);
      }
    } else {
      const label = document.createElement('span');
      label.className = 'counter-name';
      label.textContent = habit.name;
      add.appendChild(label);
    }

    const said = DataManager.hasTarget(habit)
      ? (DataManager.direction(habit.type) === 'limit'
          ? `${value} of a limit of ${habit.goal}`
          : `${value} of a goal of ${habit.goal}`)
      : `counted ${value}`;
    add.title = `${habit.name}: ${said} — tap to add one`;
    add.setAttribute('aria-label', add.title);

    add.addEventListener('click', () => {
      if (!this.selectedDate) return;
      this.dataManager.incrementCounter(this.selectedDate, habit.name);
      if (this.onHabitToggled) this.onHabitToggled();
      if (this.onCounterIncremented) this.onCounterIncremented();
      this.render();
    });

    const count = document.createElement('button');
    count.className = 'counter-value';
    count.disabled = !this.selectedDate;
    count.textContent = `${value}`;

    // The word is not repeated here. Which way the number means is already on
    // the pill: a limit belongs to a bad habit, which is red, and going past
    // one turns the number red and rings the pill.
    if (DataManager.hasTarget(habit)) {
      const target = document.createElement('span');
      target.className = 'counter-goal';
      target.textContent = `/${habit.goal}`;
      count.appendChild(target);
    }

    count.title = `${habit.name}: ${said} — tap to type it`;
    count.setAttribute('aria-label', count.title);
    count.addEventListener('click', () => this.editCount(pill, count, habit, value));

    pill.appendChild(add);
    pill.appendChild(count);
    return pill;
  }

  // Typing the number, using whatever numeric keyboard the phone has. This is
  // also the only way down: there is no minus, because a number you can type
  // is a number you can lower.
  editCount(pill, count, habit, value) {
    if (!this.selectedDate) return;

    const field = document.createElement('input');
    field.className = 'counter-entry';
    field.type = 'text';
    field.inputMode = 'numeric';
    field.value = String(value);
    field.setAttribute('aria-label', `${habit.name} count`);

    // Both ways out run once: blur fires after a commit re-render as well, and
    // the second run put back what the first had just replaced
    let closed = false;
    const finish = (commit) => {
      if (closed) return;
      closed = true;

      const typed = parseInt(field.value, 10);
      if (commit && Number.isFinite(typed) && typed >= 0 && typed !== value) {
        this.dataManager.setCounterValue(this.selectedDate, habit.name, typed);
        if (this.onHabitToggled) this.onHabitToggled();
      }
      this.render();
    };

    field.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };
    field.onblur = () => finish(true);


    // Padding and min-width get it close; they do not get it exact, because
    // the outgoing element's width comes from its content and this one's does
    // not. Pinned from the box being replaced so the row cannot move at all.
    const was = count.getBoundingClientRect && count.getBoundingClientRect();
    if (was && was.width) field.style.width = `${was.width}px`;
    pill.replaceChild(field, count);
    field.focus();
    field.select();
  }

  render() {
    this.clearElement(this.habitsListElement);

    const habits = this.dataManager.getHabits();
    
    if (habits.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.style.textAlign = 'center';
      placeholder.style.color = '#888';
      // Same wording as the first-run coach mark, which points at the same
      // button: tap, not click, and named rather than quoted as an emoji
      placeholder.textContent = 'No habits yet. Tap the gear to add one.';
      this.habitsListElement.appendChild(placeholder);
      return;
    }

    if (!this.selectedDate) {
      const hint = document.createElement('div');
      hint.className = 'habits-hint';
      hint.textContent = 'Pick a day on the calendar to log habits.';
      this.habitsListElement.appendChild(hint);
    }

    DataManager.inDisplayOrder(habits).forEach(habit => {
      const button = this.createHabitButton(habit);
      this.habitsListElement.appendChild(button);
    });
  }
}