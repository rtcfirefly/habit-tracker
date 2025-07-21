class HabitManager {
  constructor(modalElement, formElement, dataManager) {
    this.modalElement = modalElement;
    this.formElement = formElement;
    this.dataManager = dataManager;
    this.dragStartIndex = null;
    this.onHabitsChanged = null;
    
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
    const types = ['good', 'bad', 'neutral'];
    return types.map(type => {
      const option = document.createElement('option');
      option.value = type;
      option.text = type;
      return option;
    });
  }

  createAddHabitSection() {
    const addWrapper = document.createElement('div');
    addWrapper.className = 'manage-item';
    
    const nameInput = document.createElement('input');
    nameInput.placeholder = 'New habit name';
    
    const typeSelect = document.createElement('select');
    this.createHabitTypeOptions().forEach(option => {
      typeSelect.appendChild(option);
    });
    
    const addButton = document.createElement('button');
    addButton.innerText = '➕';
    addButton.onclick = () => {
      const name = nameInput.value.trim();
      const type = typeSelect.value;
      if (name) {
        this.dataManager.addHabit(name, type);
        this.renderForm();
        this.notifyHabitsChanged();
        nameInput.value = '';
      }
    };
    
    addWrapper.appendChild(nameInput);
    addWrapper.appendChild(typeSelect);
    addWrapper.appendChild(addButton);
    
    return addWrapper;
  }

  createHabitItem(habit, index) {
    const wrapper = document.createElement('div');
    wrapper.className = `manage-item ${habit.type}`;
    wrapper.draggable = true;
    
    const dragHandle = this.createDragHandle();
    const nameInput = this.createNameInput(habit, index);
    const typeSelect = this.createTypeSelect(habit, index);
    const deleteButton = this.createDeleteButton(index);
    
    wrapper.appendChild(dragHandle);
    wrapper.appendChild(nameInput);
    wrapper.appendChild(typeSelect);
    wrapper.appendChild(deleteButton);
    
    this.addDragHandlers(wrapper, index);
    
    return wrapper;
  }

  createDragHandle() {
    const dragHandle = document.createElement('div');
    dragHandle.innerText = '☰';
    dragHandle.className = 'drag-handle';
    return dragHandle;
  }

  createNameInput(habit, index) {
    const input = document.createElement('input');
    input.value = habit.name;
    input.onchange = (e) => {
      this.dataManager.updateHabit(index, e.target.value, habit.type);
      this.notifyHabitsChanged();
    };
    return input;
  }

  createTypeSelect(habit, index) {
    const select = document.createElement('select');
    this.createHabitTypeOptions().forEach(option => {
      if (habit.type === option.value) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    select.onchange = (e) => {
      this.dataManager.updateHabit(index, habit.name, e.target.value);
      this.notifyHabitsChanged();
    };
    return select;
  }

  createDeleteButton(index) {
    const deleteButton = document.createElement('button');
    deleteButton.innerText = '❌';
    deleteButton.onclick = () => {
      if (confirm('Delete this habit?')) {
        this.dataManager.deleteHabit(index);
        this.renderForm();
        this.notifyHabitsChanged();
      }
    };
    return deleteButton;
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
    
    this.formElement.appendChild(this.createAddHabitSection());
    
    const habits = this.dataManager.getHabits();
    habits.forEach((habit, index) => {
      const habitItem = this.createHabitItem(habit, index);
      this.formElement.appendChild(habitItem);
    });
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