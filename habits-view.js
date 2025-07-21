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
    button.textContent = habit.name;

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