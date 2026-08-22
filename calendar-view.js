class CalendarView {
  constructor(calendarElement, monthYearElement, dataManager) {
    this.calendarElement = calendarElement;
    this.monthYearElement = monthYearElement;
    this.dataManager = dataManager;
    this.currentDate = new Date();
    this.selectedDate = new Date().toDateString();
    this.onDateSelected = null;
  }

  isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  getMonthDays(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    let start = new Date(firstDay);
    start.setDate(start.getDate() - start.getDay());
    
    let end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - end.getDay()));
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }

  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  createDayElement(day) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    const dayKey = day.toDateString();

    const dateText = document.createElement('div');
    dateText.textContent = day.getDate();
    dayDiv.appendChild(dateText);

    if (day.getMonth() !== this.currentDate.getMonth()) {
      dayDiv.classList.add('other-month');
    }
    if (this.isSameDay(day, new Date())) {
      dayDiv.classList.add('today');
    }
    if (dayKey === this.selectedDate) {
      dayDiv.classList.add('selected');
    }

    this.addHabitDots(dayDiv, dayKey);
    this.addDayClickHandler(dayDiv, dayKey);

    return dayDiv;
  }


  createHabitIndicator(habitName, type, title, isDeleted) {
    const emoji = EmojiUtils.extractEmoji(habitName);
    const indicator = document.createElement('div');

    indicator.className = emoji ? `habit-emoji ${type}` : `habit-dot ${type}`;
    if (emoji) {
      indicator.textContent = emoji;
    }
    indicator.title = title;
    if (isDeleted) {
      indicator.classList.add('deleted');
    }

    return indicator;
  }

  addHabitDots(dayDiv, dayKey) {
    // Always present, even when empty, so every day box reserves the same icon area
    const dots = document.createElement('div');
    dots.className = 'day-dots';
    dayDiv.appendChild(dots);

    const habits = this.dataManager.getHabits();

    // Completed habits, including ones whose habit has since been deleted
    this.dataManager.getCompletedHabitsForDate(dayKey).forEach(habitName => {
      const habit = habits.find(h => h.name === habitName);
      dots.appendChild(habit
        ? this.createHabitIndicator(habitName, habit.type, habit.name, false)
        : this.createHabitIndicator(habitName, 'neutral', `${habitName} (deleted)`, true));
    });

    // Counter habits that reached their goal
    habits.forEach(habit => {
      if (habit.type === 'counter' && this.dataManager.isCounterHabitCompleted(dayKey, habit.name)) {
        dots.appendChild(this.createHabitIndicator(habit.name, 'counter', habit.name, false));
      }
    });

    // Counter habits that were deleted but still have progress recorded
    this.dataManager.getOrphanedCounterHabitsForDate(dayKey).forEach(habitName => {
      const value = this.dataManager.getCounterValue(dayKey, habitName);
      dots.appendChild(
        this.createHabitIndicator(habitName, 'counter', `${habitName}: ${value} (deleted)`, true));
    });
  }

  addDayClickHandler(dayDiv, dayKey) {
    dayDiv.addEventListener('click', () => {
      this.selectedDate = dayKey;
      if (this.onDateSelected) {
        this.onDateSelected(dayKey);
      }
      this.render();
    });
  }

  render() {
    this.clearElement(this.calendarElement);

    const days = this.getMonthDays(this.currentDate.getFullYear(), this.currentDate.getMonth());
    this.monthYearElement.textContent = this.currentDate.toLocaleString('default', { 
      month: 'long', 
      year: 'numeric' 
    });

    if (new Date(this.selectedDate).getMonth() !== this.currentDate.getMonth() ||
        new Date(this.selectedDate).getFullYear() !== this.currentDate.getFullYear()) {
      this.selectedDate = null;
    }

    days.forEach(day => {
      const dayElement = this.createDayElement(day);
      this.calendarElement.appendChild(dayElement);
    });
  }

  goToPreviousMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  }

  goToNextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  }

  getSelectedDate() {
    return this.selectedDate;
  }
}