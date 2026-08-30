class DataManager {
  constructor() {
    this.habits = this.loadHabits();
    this.completions = this.loadCompletions();
    this.counters = this.loadCounters();
    this.onChanged = null;
  }

  loadHabits() {
    return DataManager.migrate(JSON.parse(localStorage.getItem('habits') || '[]'));
  }

  // Counting used to be a fourth type. It is a property now, because it is a
  // way of measuring a habit rather than a kind of habit - "read pages" is a
  // good habit whether or not you count the pages.
  //
  // A stored counter carries no good/bad/neutral, so there is nothing to infer
  // from and guessing would be worse than not: a cigarette counter guessed as
  // good becomes a habit the app congratulates you for. Neutral is the type
  // that asserts nothing, so that is where they land. The old goal is kept,
  // unused, so retyping the habit to good or bad brings its number back.
  static migrate(habits) {
    return habits.map(habit => (habit.type === 'counter'
      ? { ...habit, type: 'neutral', counted: true }
      : habit));
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

    if (this.onChanged) {
      this.onChanged();
    }
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

  addHabit(name, type, goal = null, counted = false) {
    // Completions and counters are keyed by name, so two habits sharing one
    // would toggle and count as a single habit
    if (this.hasHabitNamed(name)) {
      return false;
    }

    const habit = { name, type };
    if (counted) {
      habit.counted = true;
      if (goal !== null) habit.goal = goal;
    }
    this.habits.push(habit);
    this.saveData();
    return true;
  }

  updateHabit(index, name, type, goal = null, counted = null) {
    if (this.habits[index] && !this.hasHabitNamed(name, index)) {
      const oldName = this.habits[index].name;
      const newName = name;
      
      // Update the habit
      this.habits[index].name = newName;
      this.habits[index].type = type;
      
      // The goal is never deleted on a type change. It is the number someone
      // typed, and switching a habit between kinds - or off counting and back
      // - should not silently throw it away; direction() decides whether it
      // means anything, and countState() ignores it when it does not.
      if (goal !== null) {
        this.habits[index].goal = goal;
      }
      if (counted === null) {
        // not stated, leave as it is
      } else if (counted) {
        this.habits[index].counted = true;
      } else {
        delete this.habits[index].counted;
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
    // Read-only: this sits on the render path, so it must not create buckets
    const dateCounters = this.counters[dateKey];
    return (dateCounters && dateCounters[habitName]) || 0;
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

  // What a number means depends on the habit, and the habit's own type already
  // says which way is better. Nothing to choose and nothing to explain: a good
  // habit whose number was a ceiling would be a bad habit in the wrong tab.
  static direction(type) {
    if (type === 'good') return 'goal';    // done when you reach it
    if (type === 'bad') return 'limit';    // fine until you pass it
    return 'tally';                        // neutral: counted, never finished
  }

  static isCounted(habit) {
    return Boolean(habit && habit.counted);
  }

  // Whether a counted habit has a number to be measured against at all. A
  // neutral one is a bare tally: it counts, and there is nothing to reach.
  static hasTarget(habit) {
    return DataManager.isCounted(habit) &&
           DataManager.direction(habit.type) !== 'tally' &&
           Number(habit.goal) > 0;
  }

  // one of: none (nothing logged), counting (a tally with no target),
  // under (on the way, or inside a limit), done (reached a goal), over (past a
  // limit). The calendar and the buttons both read this rather than each
  // deciding for themselves.
  static countState(habit, value) {
    if (!value || value <= 0) return 'none';
    if (!DataManager.hasTarget(habit)) return 'counting';

    const goal = Number(habit.goal);
    if (DataManager.direction(habit.type) === 'limit') {
      return value > goal ? 'over' : 'under';
    }
    return value >= goal ? 'done' : 'under';
  }

  // The order habits appear in, everywhere they are listed. Good and bad sit at
  // opposite ends with neutral between, so a row reads as a scale rather than
  // putting the two opposites side by side; counters come last.
  //
  // Shared rather than repeated: the buttons under the calendar and the day
  // sheet list the same habits, and a reader comparing them should not have to
  // work out whether two sorts agree.
  static inDisplayOrder(habits) {
    const order = ['good', 'neutral', 'bad', 'counter'];
    return habits.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  // How far a counter got, as a whole percent, clamped. Pure and static so the
  // fill can be tested without a browser - it is CSS that draws it, but this
  // decides the number.
  static progressPercent(value, goal) {
    if (!goal || goal <= 0 || !value || value <= 0) return 0;
    return Math.min(100, Math.round((value / goal) * 100));
  }

  counterProgress(dateKey, habitName) {
    const habit = this.habits.find(h => h.name === habitName);
    if (!habit) return 0;
    return DataManager.progressPercent(this.getCounterValue(dateKey, habitName), habit.goal);
  }

  // Reaching a goal is done. Staying inside a limit is not "done" - it is only
  // known at the end of the day, and a tally is never done at all - so this is
  // true for one state and one state only.
  isCounterHabitCompleted(dateKey, habitName) {
    const habit = this.habits.find(h => h.name === habitName);
    if (!DataManager.isCounted(habit)) return false;
    return DataManager.countState(habit, this.getCounterValue(dateKey, habitName)) === 'done';
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

      if (typeof importedData.completions !== 'object' || Array.isArray(importedData.completions)) {
        throw new Error('Invalid data format: completions must be an object');
      }

      const counters = importedData.counters || {};
      if (typeof counters !== 'object' || Array.isArray(counters)) {
        throw new Error('Invalid data format: counters must be an object');
      }

      // 'counter' stays valid forever: it is not offered any more, but every
      // backup written before this change still says it, and those files are
      // the only copy of some people's history. loadHabits() migrates it.
      const validHabitTypes = ['good', 'bad', 'neutral', 'counter'];
      const seenNames = new Set();
      for (const habit of importedData.habits) {
        if (!habit.name || !habit.type || !validHabitTypes.includes(habit.type)) {
          throw new Error('Invalid habit data: each habit must have name and type (good/bad/neutral/counter)');
        }
        if (seenNames.has(habit.name)) {
          throw new Error(`Invalid habit data: duplicate habit name "${habit.name}"`);
        }
        seenNames.add(habit.name);

        // A counted habit with no usable goal can never be completed, so
        // repair it rather than rejecting a backup. Keyed on `counted` as
        // well as the retired type, because both shapes exist in files people
        // already have on disk.
        if (habit.counted || habit.type === 'counter') {
          const goal = Math.floor(Number(habit.goal));
          habit.goal = Number.isFinite(goal) && goal >= 1 ? goal : 1;
        }
      }

      for (const dateKey in importedData.completions) {
        const completed = importedData.completions[dateKey];
        if (!Array.isArray(completed) || completed.some(name => typeof name !== 'string')) {
          throw new Error(`Invalid completion data for ${dateKey}: expected an array of habit names`);
        }
      }

      for (const dateKey in counters) {
        const dateCounters = counters[dateKey];
        if (typeof dateCounters !== 'object' || dateCounters === null || Array.isArray(dateCounters)) {
          throw new Error(`Invalid counter data for ${dateKey}: expected an object of habit counts`);
        }
        for (const habitName in dateCounters) {
          if (!Number.isFinite(dateCounters[habitName])) {
            throw new Error(`Invalid counter value for "${habitName}" on ${dateKey}`);
          }
        }
      }

      this.habits = importedData.habits;
      this.completions = importedData.completions;
      this.counters = counters;
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