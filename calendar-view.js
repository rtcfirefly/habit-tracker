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


  addHabitDots(dayDiv, dayKey) {
    const completedHabits = this.dataManager.getCompletedHabitsForDate(dayKey);
    const habits = this.dataManager.getHabits();
    
    // Add regular completed habits (both active and deleted)
    completedHabits.forEach(habitName => {
      const habit = habits.find(h => h.name === habitName);
        const dot = document.createElement('div');
      const emoji = EmojiUtils.extractEmoji(habitName);
        
      if (habit) {
        // Active habit - use its current type
        if (emoji) {
          dot.className = `habit-emoji ${habit.type}`;
          dot.textContent = emoji;
          dot.title = habit.name;
        } else {
          dot.className = `habit-dot ${habit.type}`;
        }
      } else {
        // Deleted habit - show as neutral with dimmed appearance
        if (emoji) {
          dot.className = `habit-emoji neutral`;
          dot.textContent = emoji;
          dot.title = `${habitName} (deleted)`;
          dot.style.opacity = '0.6';
        } else {
          dot.className = `habit-dot neutral`;
          dot.title = `${habitName} (deleted)`;
          dot.style.opacity = '0.6';
        }
      }
        
        dayDiv.appendChild(dot);
    });
    
    // Add completed counter habits (active ones)
    habits.forEach(habit => {
      if (habit.type === 'counter' && this.dataManager.isCounterHabitCompleted(dayKey, habit.name)) {
        const dot = document.createElement('div');
        const emoji = EmojiUtils.extractEmoji(habit.name);
        
        if (emoji) {
          dot.className = `habit-emoji counter`;
          dot.textContent = emoji;
          dot.title = habit.name;
        } else {
          dot.className = `habit-dot counter`;
        }
        
        dayDiv.appendChild(dot);
      }
    });

    // Add orphaned counter habits (deleted but had progress)
    const orphanedCounters = this.dataManager.getOrphanedCounterHabitsForDate(dayKey);
    orphanedCounters.forEach(habitName => {
      const dot = document.createElement('div');
      const emoji = EmojiUtils.extractEmoji(habitName);
      const counterValue = this.dataManager.getCounterValue(dayKey, habitName);

      if (emoji) {
        dot.className = `habit-emoji counter`;
        dot.textContent = emoji;
        dot.title = `${habitName}: ${counterValue} (deleted)`;
        dot.style.opacity = '0.6';
      } else {
        dot.className = `habit-dot counter`;
        dot.title = `${habitName}: ${counterValue} (deleted)`;
        dot.style.opacity = '0.6';
      }

      dayDiv.appendChild(dot);
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