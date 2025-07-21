class HabitManager {
  constructor(modalElement, formElement, dataManager) {
    this.modalElement = modalElement;
    this.formElement = formElement;
    this.dataManager = dataManager;
    this.dragStartIndex = null;
    this.onHabitsChanged = null;
    this.activeTab = 'good';
    
    this.setupModalCloseHandler();
  }

  setupModalCloseHandler() {
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
  }

  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  createHabitTypeOptions() {
    const types = ['good', 'bad', 'neutral', 'counter'];
    return types.map(type => {
      const option = document.createElement('option');
      option.value = type;
      option.text = type;
      return option;
    });
  }

  createAddHabitSection(currentType = null) {
    const section = document.createElement('div');
    section.className = 'add-habit-section';
    
    const title = document.createElement('h3');
    title.textContent = 'Add New Habit';
    title.style.margin = '0 0 1rem 0';
    
    const form = document.createElement('div');
    form.className = 'add-habit-form';
    
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'Habit name (e.g., "💧 Water", "Exercise")';
    
    const typeSelect = document.createElement('select');
    this.createHabitTypeOptions().forEach(option => {
      if (currentType && option.value === currentType) {
        option.selected = true;
      }
      typeSelect.appendChild(option);
    });
    
    const goalInput = document.createElement('input');
    goalInput.type = 'number';
    goalInput.placeholder = 'Goal';
    goalInput.min = '1';
    goalInput.style.display = (currentType === 'counter') ? 'block' : 'none';
    goalInput.className = 'goal-input';
    
    typeSelect.onchange = () => {
      if (typeSelect.value === 'counter') {
        goalInput.style.display = 'block';
      } else {
        goalInput.style.display = 'none';
      }
    };
    
    const addButton = document.createElement('button');
    addButton.textContent = 'Add Habit';
    addButton.onclick = () => {
      const name = nameInput.value.trim();
      const type = typeSelect.value;
      const goal = type === 'counter' ? parseInt(goalInput.value) || 1 : null;
      
      if (name) {
        this.dataManager.addHabit(name, type, goal);
        this.renderForm();
        this.notifyHabitsChanged();
        nameInput.value = '';
        goalInput.value = '';
      }
    };
    
    form.appendChild(nameInput);
    form.appendChild(typeSelect);
    form.appendChild(goalInput);
    form.appendChild(addButton);
    
    section.appendChild(title);
    section.appendChild(form);
    
    return section;
  }

  createHabitItem(habit, index) {
    const wrapper = document.createElement('div');
    wrapper.className = `manage-item ${habit.type}`;
    wrapper.draggable = true;
    
    const content = document.createElement('div');
    content.className = 'manage-item-content';
    
    const dragHandle = this.createDragHandle();
    const nameDisplay = this.createNameDisplay(habit, index);
    const controls = this.createHabitControls(habit, index);
    
    content.appendChild(dragHandle);
    content.appendChild(nameDisplay);
    content.appendChild(controls);
    
    wrapper.appendChild(content);
    
    this.addDragHandlers(wrapper, index);
    
    return wrapper;
  }

  createDragHandle() {
    const dragHandle = document.createElement('div');
    dragHandle.innerText = '⋮';
    dragHandle.className = 'drag-handle';
    return dragHandle;
  }

  extractEmoji(text) {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    const match = text.match(emojiRegex);
    return match ? match[0] : null;
  }

  createNameDisplay(habit, index) {
    const display = document.createElement('div');
    display.className = 'habit-name-display';
    
    const emoji = this.extractEmoji(habit.name);
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.className = `habit-emoji ${habit.type}`;
      emojiSpan.textContent = emoji;
      display.appendChild(emojiSpan);
      
      const textWithoutEmoji = habit.name.replace(emoji, '').trim();
      if (textWithoutEmoji) {
        display.appendChild(document.createTextNode(' ' + textWithoutEmoji));
      }
    } else {
      display.textContent = habit.name;
    }
    
    // Add goal info for counter habits
    if (habit.type === 'counter' && habit.goal) {
      const goalSpan = document.createElement('span');
      goalSpan.style.opacity = '0.7';
      goalSpan.style.fontSize = '0.9em';
      goalSpan.textContent = ` (goal: ${habit.goal})`;
      display.appendChild(goalSpan);
    }
    
    display.onclick = () => this.startInlineEdit(display, habit, index);
    
    return display;
  }

  startInlineEdit(display, habit, index) {
    const input = document.createElement('input');
    input.className = 'habit-name-edit';
    input.value = habit.name;
    
    const finishEdit = () => {
      const newName = input.value.trim();
      if (newName && newName !== habit.name) {
        this.dataManager.updateHabit(index, newName, habit.type, habit.goal);
        this.notifyHabitsChanged();
      }
      this.renderForm();
    };
    
    input.onblur = finishEdit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        this.renderForm();
      }
    };
    
    display.parentNode.replaceChild(input, display);
    input.focus();
    input.select();
  }

  createHabitControls(habit, index) {
    const controls = document.createElement('div');
    controls.className = 'habit-controls';
    
    // Only show goal input for counter habits
    if (habit.type === 'counter') {
      const goalInput = document.createElement('input');
      goalInput.type = 'number';
      goalInput.className = 'goal-input';
      goalInput.placeholder = 'Goal';
      goalInput.min = '1';
      goalInput.value = habit.goal || '';
      goalInput.title = 'Goal for this counter habit';
      
      goalInput.onchange = (e) => {
        const goal = parseInt(e.target.value) || 1;
        this.dataManager.updateHabit(index, habit.name, habit.type, goal);
        this.notifyHabitsChanged();
      };
      
      controls.appendChild(goalInput);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete habit';
    
    deleteBtn.onclick = () => {
      if (confirm(`Delete "${habit.name}"?`)) {
        this.dataManager.deleteHabit(index);
        this.renderForm();
        this.notifyHabitsChanged();
      }
    };
    
    controls.appendChild(deleteBtn);
    
    return controls;
  }
  


  addDragHandlers(wrapper, index) {
    wrapper.addEventListener('dragstart', () => {
      this.dragStartIndex = index;
      wrapper.classList.add('dragging');
    });
    
    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
    });
    
    wrapper.addEventListener('dragover', (e) => e.preventDefault());
    
    wrapper.addEventListener('drop', () => {
      this.dataManager.reorderHabits(this.dragStartIndex, index);
      this.renderForm();
      this.notifyHabitsChanged();
    });
  }

  renderForm() {
    this.clearElement(this.formElement);
    
    const habits = this.dataManager.getHabits();
    const groupedHabits = this.groupHabitsByType(habits);
    
    const typeOrder = ['good', 'bad', 'neutral', 'counter'];
    const typeLabels = {
      good: 'Good Habits',
      bad: 'Bad Habits', 
      neutral: 'Neutral Habits',
      counter: 'Counter Habits'
    };
    
    // Create tabs
    const tabsContainer = this.createTabsContainer(typeOrder, typeLabels, groupedHabits);
    this.formElement.appendChild(tabsContainer);
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'tab-content-wrapper';
    
    // Create tab contents
    typeOrder.forEach(type => {
      const tabContent = this.createTabContent(type, typeLabels[type], groupedHabits[type] || []);
      contentWrapper.appendChild(tabContent);
    });
    
    this.formElement.appendChild(contentWrapper);
  }
  
  groupHabitsByType(habits) {
    return habits.reduce((groups, habit, index) => {
      const type = habit.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({ habit, index });
      return groups;
    }, {});
  }
  
  createTabsContainer(typeOrder, typeLabels, groupedHabits) {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'habit-tabs';
    
    typeOrder.forEach(type => {
      const tab = document.createElement('button');
      tab.className = `habit-tab ${type}`;
      tab.textContent = typeLabels[type];
      
      const habitCount = groupedHabits[type] ? groupedHabits[type].length : 0;
      if (habitCount > 0) {
        tab.textContent += ` (${habitCount})`;
      }
      
      if (type === this.activeTab) {
        tab.classList.add('active');
      }
      
      tab.onclick = () => this.switchTab(type);
      
      tabsContainer.appendChild(tab);
    });
    
    return tabsContainer;
  }
  
  createTabContent(type, label, habitsWithIndices) {
    const content = document.createElement('div');
    content.className = `habit-tab-content ${type}`;
    content.id = `tab-${type}`;
    
    if (type === this.activeTab) {
      content.classList.add('active');
    }
    
    // Add "Add Habit" section for the active tab
    if (type === this.activeTab) {
      content.appendChild(this.createAddHabitSection(type));
    }
    
    // Add habits for this type
    if (habitsWithIndices.length > 0) {
      habitsWithIndices.forEach(({ habit, index }) => {
        const habitItem = this.createHabitItem(habit, index);
        content.appendChild(habitItem);
      });
    } else {
      const emptyMessage = document.createElement('div');
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.color = '#888';
      emptyMessage.style.padding = '2rem';
      emptyMessage.textContent = `No ${label.toLowerCase()} yet. Add one above!`;
      content.appendChild(emptyMessage);
    }
    
    return content;
  }
  
  switchTab(newTab) {
    this.activeTab = newTab;
    this.renderForm();
  }

  notifyHabitsChanged() {
    if (this.onHabitsChanged) {
      this.onHabitsChanged();
    }
  }

  open() {
    this.modalElement.style.display = 'flex';
    this.renderForm();
  }

  close() {
    this.modalElement.style.display = 'none';
  }
}