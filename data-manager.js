class DataManager {
  constructor() {
    this.habits = this.loadHabits();
    this.completions = this.loadCompletions();
  }

  loadHabits() {
    return JSON.parse(localStorage.getItem('habits') || '[]');
  }

  loadCompletions() {
    return JSON.parse(localStorage.getItem('completions') || '{}');
  }

  saveData() {
    localStorage.setItem('habits', JSON.stringify(this.habits));
    localStorage.setItem('completions', JSON.stringify(this.completions));
  }

  getHabits() {
    return this.habits;
  }

  getCompletions() {
    return this.completions;
  }

  addHabit(name, type) {
    this.habits.push({ name, type });
    this.saveData();
  }

  updateHabit(index, name, type) {
    if (this.habits[index]) {
      const oldName = this.habits[index].name;
      const newName = name;
      
      // Update the habit
      this.habits[index].name = newName;
      this.habits[index].type = type;
      
      // If the name changed, update all completion records
      if (oldName !== newName) {
        this.updateCompletionRecords(oldName, newName);
      }
      
      this.saveData();
    }
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

  deleteHabit(index) {
    if (this.habits[index]) {
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

  exportData() {
    const exportData = {
      habits: this.habits,
      completions: this.completions,
      exportDate: new Date().toISOString(),
      version: '1.0'
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

      const validHabitTypes = ['good', 'bad', 'neutral'];
      for (const habit of importedData.habits) {
        if (!habit.name || !habit.type || !validHabitTypes.includes(habit.type)) {
          throw new Error('Invalid habit data: each habit must have name and type (good/bad/neutral)');
        }
      }

      this.habits = importedData.habits;
      this.completions = importedData.completions;
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