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
    this.addDayClickHandler(dayDiv, day, dayKey);

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

  setSelectedDate(dateKey) {
    this.selectedDate = dateKey;
    // Always announced, including the null case, so HabitsView can never be
    // left logging against a day the calendar no longer shows
    if (this.onDateSelected) {
      this.onDateSelected(dateKey);
    }
  }

  isInCurrentMonth(dateKey) {
    const date = new Date(dateKey);
    return date.getMonth() === this.currentDate.getMonth() &&
           date.getFullYear() === this.currentDate.getFullYear();
  }

  addDayClickHandler(dayDiv, day, dayKey) {
    dayDiv.addEventListener('click', () => {
      // A greyed neighbouring-month day belongs to another month, so move there
      // first; otherwise render() would immediately clear the new selection
      this.currentDate = new Date(day.getFullYear(), day.getMonth(), 1);
      this.setSelectedDate(dayKey);
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

    if (this.selectedDate && !this.isInCurrentMonth(this.selectedDate)) {
      this.setSelectedDate(null);
    }

    days.forEach(day => {
      const dayElement = this.createDayElement(day);
      this.calendarElement.appendChild(dayElement);
    });
  }

  goToMonth(offset) {
    // Rebuilt from year/month rather than mutating the day, which would
    // overflow whenever the current day-of-month is missing from the target
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + offset,
      1
    );
    this.render();
  }

  goToPreviousMonth() {
    this.goToMonth(-1);
  }

  goToNextMonth() {
    this.goToMonth(1);
  }

  getSelectedDate() {
    return this.selectedDate;
  }
}