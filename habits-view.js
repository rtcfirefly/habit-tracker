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
  createCounterHabit(habit) {
    const button = document.createElement('button');
    button.className = `habit-counter ${habit.type}`;
    button.disabled = !this.selectedDate;

    const value = this.selectedDate
      ? this.dataManager.getCounterValue(this.selectedDate, habit.name)
      : 0;
    // A tally has nothing to fill toward, so it does not fill
    const state = DataManager.countState(habit, value);
    const progress = DataManager.hasTarget(habit)
      ? DataManager.progressPercent(value, habit.goal)
      : 0;
    button.style.setProperty('--pct', `${progress}%`);

    if (state === 'done') button.classList.add('completed');
    if (state === 'over') button.classList.add('over-limit');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'counter-name';

    const emoji = EmojiUtils.extractEmoji(habit.name);
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = `habit-emoji ${habit.type} filling`;
      emojiSpan.style.setProperty('--pct', `${progress}%`);
      emojiSpan.textContent = emoji;
      nameSpan.appendChild(emojiSpan);

      const rest = EmojiUtils.removeEmoji(habit.name);
      if (rest) {
        nameSpan.appendChild(document.createTextNode(' ' + rest));
      }
    } else {
      nameSpan.textContent = habit.name;
    }

    const count = document.createElement('span');
    count.className = 'counter-value';
    count.textContent = `${value}`;

    // Just the two numbers. Which way they mean is already on the button: a
    // limit belongs to a bad habit, which is red, and going past one turns the
    // number red and rings the button. Spelling "of max 3" out here cost more
    // width than the whole name on a 320px phone.
    if (DataManager.hasTarget(habit)) {
      const target = document.createElement('span');
      target.className = 'counter-goal';
      target.textContent = `/${habit.goal}`;
      count.appendChild(target);
    }

    button.appendChild(nameSpan);
    button.appendChild(count);

    const said = DataManager.hasTarget(habit)
      ? (DataManager.direction(habit.type) === 'limit'
          ? `${value} of a limit of ${habit.goal}`
          : `${value} of a goal of ${habit.goal}`)
      : `counted ${value}`;
    button.title = `${habit.name}: ${said} — tap to add one`;
    button.setAttribute('aria-label', button.title);

    button.addEventListener('click', () => {
      if (!this.selectedDate) return;
      this.dataManager.incrementCounter(this.selectedDate, habit.name);
      if (this.onHabitToggled) this.onHabitToggled();
      if (this.onCounterIncremented) this.onCounterIncremented();
      this.render();
    });

    return button;
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