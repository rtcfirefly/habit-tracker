class DataManager {
  constructor() {
    this.habits = this.loadHabits();
    this.completions = this.loadCompletions();
    this.counters = this.loadCounters();
  }

  loadHabits() {
    return JSON.parse(localStorage.getItem('habits') || '[]');
  }

  loadCompletions() {
    return JSON.parse(localStorage.getItem('completions') || '{}');
  }

  loadCounters() {
    return JSON.parse(localStorage.getItem('counters') || '{}');
  }

  saveData() {
    localStorage.setItem('habits', JSON.stringify(this.habits));
    localStorage.setItem('completions', JSON.stringify(this.completions));
    localStorage.setItem('counters', JSON.stringify(this.counters));
  }

  getHabits() {
    // A copy: rendering must not be able to reorder or mutate the stored list
    return this.habits.slice();
  }

  getCompletions() {
    return this.completions;
  }

  hasHabitNamed(name, exceptIndex = -1) {
    return this.habits.some((habit, index) => index !== exceptIndex && habit.name === name);
  }

  addHabit(name, type, goal = null) {
    // Completions and counters are keyed by name, so two habits sharing one
    // would toggle and count as a single habit
    if (this.hasHabitNamed(name)) {
      return false;
    }

    const habit = { name, type };
    if (type === 'counter' && goal !== null) {
      habit.goal = goal;
    }
    this.habits.push(habit);
    this.saveData();
    return true;
  }

  updateHabit(index, name, type, goal = null) {
    if (this.habits[index] && !this.hasHabitNamed(name, index)) {
      const oldName = this.habits[index].name;
      const newName = name;
      
      // Update the habit
      this.habits[index].name = newName;
      this.habits[index].type = type;
      
      // Handle counter goal
      if (type === 'counter' && goal !== null) {
        this.habits[index].goal = goal;
      } else if (type !== 'counter') {
        delete this.habits[index].goal;
      }
      
      // If the name changed, re-key every record that is stored by habit name
      if (oldName !== newName) {
        this.updateCompletionRecords(oldName, newName);
        this.updateCounterRecords(oldName, newName);
      }
      
      this.saveData();
      return true;
    }

    return false;
  }

  updateCompletionRecords(oldName, newName) {
    // Go through all dates and update habit name references
    for (const dateKey in this.completions) {
      const completedHabits = this.completions[dateKey];
      const index = completedHabits.indexOf(oldName);
      
      if (index !== -1) {
        // Replace old name with new name
        completedHabits[index] = newName;
      }
    }
  }

  updateCounterRecords(oldName, newName) {
    // Counters are keyed by habit name too, so a rename has to move them or
    // the history is stranded and the habit restarts at zero
    for (const dateKey in this.counters) {
      const dateCounters = this.counters[dateKey];

      if (Object.prototype.hasOwnProperty.call(dateCounters, oldName)) {
        dateCounters[newName] = dateCounters[oldName];
        delete dateCounters[oldName];
      }
    }
  }

  deleteHabit(index) {
    if (this.habits[index]) {
      // Only remove from active habits list - preserve all completion and counter data
      // This allows users to see historical data even after deleting habits
      this.habits.splice(index, 1);
      this.saveData();
    }
  }

  reorderHabits(fromIndex, toIndex) {
    const draggedItem = this.habits.splice(fromIndex, 1)[0];
    this.habits.splice(toIndex, 0, draggedItem);
    this.saveData();
  }

  toggleHabitCompletion(dateKey, habitName) {
    if (!this.completions[dateKey]) {
      this.completions[dateKey] = [];
    }
    
    const index = this.completions[dateKey].indexOf(habitName);
    if (index === -1) {
      this.completions[dateKey].push(habitName);
    } else {
      this.completions[dateKey].splice(index, 1);
    }
    this.saveData();
  }

  isHabitCompleted(dateKey, habitName) {
    return this.completions[dateKey] && this.completions[dateKey].includes(habitName);
  }

  getCompletedHabitsForDate(dateKey) {
    return this.completions[dateKey] || [];
  }

  getAllHistoricalHabitNames() {
    // Get unique habit names from all completion data (including deleted habits)
    const historicalNames = new Set();

    // Add current active habits
    this.habits.forEach(habit => historicalNames.add(habit.name));

    // Add habit names from completion history
    Object.values(this.completions).forEach(completedHabits => {
      completedHabits.forEach(habitName => historicalNames.add(habitName));
    });

    // Add habit names from counter history
    Object.values(this.counters).forEach(dateCounters => {
      Object.keys(dateCounters).forEach(habitName => historicalNames.add(habitName));
    });

    return Array.from(historicalNames).sort();
  }

  getOrphanedCounterHabitsForDate(dateKey) {
    // Returns counter habits that have data but are no longer in active habits
    const activeHabitNames = new Set(this.habits.map(h => h.name));
    const dateCounters = this.counters[dateKey] || {};

    return Object.keys(dateCounters).filter(habitName =>
      !activeHabitNames.has(habitName) && dateCounters[habitName] > 0
    );
  }

  getCounterValue(dateKey, habitName) {
    if (!this.counters[dateKey]) {
      this.counters[dateKey] = {};
    }
    return this.counters[dateKey][habitName] || 0;
  }

  setCounterValue(dateKey, habitName, value) {
    if (!this.counters[dateKey]) {
      this.counters[dateKey] = {};
    }
    this.counters[dateKey][habitName] = Math.max(0, value);
    this.saveData();
  }

  incrementCounter(dateKey, habitName) {
    const currentValue = this.getCounterValue(dateKey, habitName);
    this.setCounterValue(dateKey, habitName, currentValue + 1);
  }

  decrementCounter(dateKey, habitName) {
    const currentValue = this.getCounterValue(dateKey, habitName);
    this.setCounterValue(dateKey, habitName, currentValue - 1);
  }

  isCounterHabitCompleted(dateKey, habitName) {
    const habit = this.habits.find(h => h.name === habitName);
    if (!habit || habit.type !== 'counter') return false;
    
    const currentValue = this.getCounterValue(dateKey, habitName);
    return currentValue >= habit.goal;
  }

  exportData() {
    const exportData = {
      habits: this.habits,
      completions: this.completions,
      counters: this.counters,
      exportDate: new Date().toISOString(),
      version: '1.1'
    };
    return JSON.stringify(exportData, null, 2);
  }

  importData(jsonString) {
    try {
      const importedData = JSON.parse(jsonString);
      
      if (!importedData.habits || !importedData.completions) {
        throw new Error('Invalid data format: missing habits or completions');
      }

      if (!Array.isArray(importedData.habits)) {
        throw new Error('Invalid data format: habits must be an array');
      }

      if (typeof importedData.completions !== 'object') {
        throw new Error('Invalid data format: completions must be an object');
      }

      const validHabitTypes = ['good', 'bad', 'neutral', 'counter'];
      for (const habit of importedData.habits) {
        if (!habit.name || !habit.type || !validHabitTypes.includes(habit.type)) {
          throw new Error('Invalid habit data: each habit must have name and type (good/bad/neutral/counter)');
        }
      }

      this.habits = importedData.habits;
      this.completions = importedData.completions;
      this.counters = importedData.counters || {};
      this.saveData();
      
      return {
        success: true,
        message: `Successfully imported ${this.habits.length} habits and completion data`
      };
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error.message}`
      };
    }
  }

  downloadExport() {
    const data = this.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `habit-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}