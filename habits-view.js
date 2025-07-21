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

  extractEmoji(text) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    const match = text.match(emojiRegex);
    return match ? match[0] : null;
  }

  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  createEmptyMessage() {
    const placeholder = document.createElement('div');
    placeholder.style.textAlign = 'center';
    placeholder.style.color = '#888';
    placeholder.textContent = 'No habits yet. Click "Manage Habits" to add some!';
    return placeholder;
  }

  createHabitButton(habit) {
    const button = document.createElement('button');
    button.className = `habit-button ${habit.type}`;
    
    const emoji = this.extractEmoji(habit.name);
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

  render() {
    this.clearElement(this.habitsListElement);

    const habits = this.dataManager.getHabits();
    
    if (habits.length === 0) {
      this.habitsListElement.appendChild(this.createEmptyMessage());
      return;
    }

    habits.forEach(habit => {
      const button = this.createHabitButton(habit);
      this.habitsListElement.appendChild(button);
    });
  }
}