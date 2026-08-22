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
    if (habit.type === 'counter') {
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

  createCounterHabit(habit) {
    const wrapper = document.createElement('div');
    wrapper.className = `habit-counter ${habit.type}`;
    if (!this.selectedDate) {
      wrapper.classList.add('no-date');
    }
    
    const currentValue = this.selectedDate ? this.dataManager.getCounterValue(this.selectedDate, habit.name) : 0;
    const isCompleted = this.selectedDate ? this.dataManager.isCounterHabitCompleted(this.selectedDate, habit.name) : false;
    
    if (isCompleted) {
      wrapper.classList.add('completed');
    }
    
    // Habit name and emoji
    const nameSpan = document.createElement('span');
    nameSpan.className = 'counter-name';
    
    const emoji = EmojiUtils.extractEmoji(habit.name);
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = `habit-emoji ${habit.type}`;
      emojiSpan.textContent = emoji;
      emojiSpan.title = habit.name;
      
      const textWithoutEmoji = habit.name.replace(emoji, '').trim();
      nameSpan.appendChild(emojiSpan);
      if (textWithoutEmoji) {
        nameSpan.appendChild(document.createTextNode(' ' + textWithoutEmoji));
      }
    } else {
      nameSpan.textContent = habit.name;
    }
    
    // Counter controls
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'counter-controls';
    
    const minusButton = document.createElement('button');
    minusButton.textContent = '-';
    minusButton.className = 'counter-btn minus';
    minusButton.disabled = !this.selectedDate;
    minusButton.onclick = () => {
      if (!this.selectedDate) return;
      this.dataManager.decrementCounter(this.selectedDate, habit.name);
      if (this.onHabitToggled) this.onHabitToggled();
      this.render();
    };
    
    const countSpan = document.createElement('span');
    countSpan.className = 'counter-value';
    countSpan.textContent = `${currentValue}/${habit.goal}`;
    
    const plusButton = document.createElement('button');
    plusButton.textContent = '+';
    plusButton.className = 'counter-btn plus';
    plusButton.disabled = !this.selectedDate;
    plusButton.onclick = () => {
      if (!this.selectedDate) return;
      this.dataManager.incrementCounter(this.selectedDate, habit.name);
      if (this.onHabitToggled) this.onHabitToggled();
      this.render();
    };
    
    controlsDiv.appendChild(minusButton);
    controlsDiv.appendChild(countSpan);
    controlsDiv.appendChild(plusButton);
    
    wrapper.appendChild(nameSpan);
    wrapper.appendChild(controlsDiv);
    
    return wrapper;
  }

  render() {
    this.clearElement(this.habitsListElement);

    const habits = this.dataManager.getHabits();
    
    if (habits.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.style.textAlign = 'center';
      placeholder.style.color = '#888';
      placeholder.textContent = 'No habits yet. Click "⚙️" to add some!';
      this.habitsListElement.appendChild(placeholder);
      return;
    }

    if (!this.selectedDate) {
      const hint = document.createElement('div');
      hint.className = 'habits-hint';
      hint.textContent = 'Pick a day on the calendar to log habits.';
      this.habitsListElement.appendChild(hint);
    }

    // Sort habits by type for consistent grouping
    const typeOrder = ['good', 'bad', 'neutral', 'counter'];
    const sortedHabits = habits.slice().sort((a, b) => {
      const aIndex = typeOrder.indexOf(a.type);
      const bIndex = typeOrder.indexOf(b.type);
      return aIndex - bIndex;
    });

    sortedHabits.forEach(habit => {
      const button = this.createHabitButton(habit);
      this.habitsListElement.appendChild(button);
    });
  }
}