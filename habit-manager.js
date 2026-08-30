// Three tabs, not four: counting is a property of a habit now, not a kind of
// one. The prose forms are for placeholders and empty states.
const TYPE_TABS = { good: 'Good', bad: 'Bad', neutral: 'Neutral' };
const TYPE_NOUN = {
  good: 'good habit',
  bad: 'bad habit',
  neutral: 'neutral habit'
};

// What the number is called, per kind. The word is the whole explanation.
const TARGET_WORD = { good: 'Goal', bad: 'Limit' };

class HabitManager {
  constructor(modalElement, formElement, dataManager) {
    this.modalElement = modalElement;
    this.formElement = formElement;
    this.dataManager = dataManager;
    this.dragStartIndex = null;
    this.onHabitsChanged = null;
    // Set while one habit's screen is up; calling it puts the list back
    this.habitScreen = null;
    this.activeTab = 'good';
    
    this.previouslyFocused = null;

    this.setupModalCloseHandler();
  }

  setupModalCloseHandler() {
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.dismiss();
      }
    });

    this.modalElement.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  createAddHabitSection(currentType = null) {
    const type = currentType || this.activeTab;

    const section = document.createElement('div');
    section.className = 'add-habit-section';

    const row = document.createElement('div');
    row.className = 'add-habit-form';

    const nameInput = document.createElement('input');
    nameInput.className = 'habit-name-input';
    // The emoji example is the whole lesson about icons, taught where someone
    // is about to type rather than on a card they read once and closed
    nameInput.placeholder = `Add a ${TYPE_NOUN[type]}, e.g. 💧 Water`;
    nameInput.setAttribute('aria-label', `Name of the new ${TYPE_NOUN[type]}`);

    const addButton = document.createElement('button');
    addButton.className = 'add-habit-button';
    addButton.textContent = '+';
    addButton.title = 'Add habit';
    addButton.setAttribute('aria-label', 'Add habit');

    const error = document.createElement('div');
    error.className = 'add-habit-error';
    error.setAttribute('role', 'alert');

    const submit = () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }

      // Reported next to the field rather than in an alert(), which stole focus
      // and threw away what had been typed
      if (!this.dataManager.addHabit(name, type)) {
        error.textContent = `You already have a habit called “${name}”.`;
        nameInput.classList.add('invalid');
        nameInput.focus();
        nameInput.select();
        return;
      }

      this.renderForm();
      this.notifyHabitsChanged();
      this.focusAddField();
    };

    nameInput.oninput = () => {
      error.textContent = '';
      nameInput.classList.remove('invalid');
    };
    nameInput.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    };
    addButton.onclick = submit;

    row.appendChild(nameInput);
    row.appendChild(addButton);

    section.appendChild(row);
    section.appendChild(error);

    return section;
  }

  focusAddField() {
    const field = this.formElement.querySelector('.habit-tab-content.active .habit-name-input');
    if (field) {
      field.focus();
    }
  }

  createHabitItem(habit, index) {
    const wrapper = document.createElement('div');
    wrapper.className = `manage-item ${habit.type}`;
    // Read back after a drag to work out where the row landed
    wrapper.dataset.index = String(index);
    
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

  // "goal 30" / "max 3" / "counting" - or nothing at all when the habit is a
  // plain one tap. Short enough to sit on a row beside a name at 320px.
  static countSummary(habit) {
    if (!DataManager.isCounted(habit)) return '';
    if (!DataManager.hasTarget(habit)) return 'counting';
    return DataManager.direction(habit.type) === 'limit'
      ? `max ${habit.goal}`
      : `goal ${habit.goal}`;
  }

  // One habit, on its own. It replaces the dialog's body the way the About view
  // does rather than opening a second dialog over the first: two dialogs means
  // two focus traps and two Escape handlers, and the one underneath wins the
  // key while the one on top holds the eye.
  openHabitScreen(index) {
    const habit = this.dataManager.getHabits()[index];
    if (!habit) return;

    // One at a time. Tapping a second name used to append a second screen
    // under the first, and closing one of them put the list back while the
    // other was still on screen.
    this.closeHabitScreen();

    const body = this.modalElement.querySelector('.modal-body');
    const title = this.modalElement.querySelector('#manage-modal-title');
    const previousTitle = title.textContent;

    const screen = document.createElement('div');
    screen.className = 'habit-screen';
    screen.tabIndex = -1;

    // Held on the manager rather than in a closure, so closing the dialog can
    // tear it down too - shutting the dialog with a screen open left the
    // screen in the DOM and the list hidden behind it, and the next open
    // showed the leftovers.
    const close = () => {
      screen.remove();
      body.hidden = false;
      title.textContent = previousTitle;
      this.habitScreen = null;
      this.renderForm();
      this.notifyHabitsChanged();
      const dialog = this.modalElement.querySelector('.modal-content');
      if (dialog) dialog.focus();
    };
    this.habitScreen = close;

    const draw = () => {
      const current = this.dataManager.getHabits()[index];
      this.clearElement(screen);
      screen.appendChild(this.screenBack(close));
      screen.appendChild(this.screenName(current, index));
      screen.appendChild(this.screenCounting(current, index, draw));
      screen.appendChild(this.screenDelete(current, index, close));
    };

    // No kind control: which tab you came from already said it, and a habit
    // that is in the wrong one is moved by dragging it, not by a second way of
    // saying the same thing
    title.textContent = EmojiUtils.removeEmoji(habit.name) || habit.name;
    body.hidden = true;
    this.modalElement.querySelector('.modal-content').appendChild(screen);
    draw();
    screen.focus();
  }

  closeHabitScreen() {
    if (this.habitScreen) this.habitScreen();
  }

  // Back out one layer. A habit's screen is a place inside the dialog, so
  // every way of saying "leave" - the X, the backdrop, Escape - puts you back
  // in the list first and closes the dialog only from there. Dropping
  // straight to the calendar from inside a habit loses the place you were in
  // and gives no way back to it except starting again.
  dismiss() {
    if (this.habitScreen) {
      this.closeHabitScreen();
      return;
    }
    this.close();
  }

  screenBack(close) {
    const back = document.createElement('button');
    back.className = 'habit-screen-back';
    back.textContent = '‹ Back';
    back.onclick = close;
    return back;
  }

  screenName(habit, index) {
    const field = document.createElement('div');
    field.className = 'habit-screen-field';

    const label = document.createElement('label');
    label.className = 'habit-screen-label';
    label.textContent = 'Name';
    label.htmlFor = 'habit-screen-name';

    const input = document.createElement('input');
    input.className = 'habit-screen-input';
    input.id = 'habit-screen-name';
    input.value = habit.name;

    const save = () => {
      const name = input.value.trim();
      if (!name || name === habit.name) {
        input.value = habit.name;
        return;
      }
      if (!this.dataManager.updateHabit(index, name, habit.type)) {
        input.value = habit.name;
      }
    };

    input.onblur = save;
    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    };

    field.appendChild(label);
    field.appendChild(input);
    return field;
  }

  screenCounting(habit, index, redraw) {
    const field = document.createElement('div');
    field.className = 'habit-screen-field';

    const label = document.createElement('label');
    label.className = 'habit-screen-label';
    label.textContent = 'Counting';
    field.appendChild(label);

    const counted = DataManager.isCounted(habit);
    const seg = document.createElement('div');
    seg.className = 'habit-screen-seg';
    seg.setAttribute('role', 'group');

    [['Once', false], ['Counts', true]].forEach(([text, on]) => {
      const choice = document.createElement('button');
      choice.className = 'habit-screen-choice' + (counted === on ? ' on' : '');
      choice.textContent = text;
      choice.setAttribute('aria-pressed', String(counted === on));
      choice.onclick = () => {
        this.dataManager.updateHabit(index, habit.name, habit.type, on ? (habit.goal || 1) : null, on);
        redraw();
      };
      seg.appendChild(choice);
    });

    field.appendChild(seg);

    if (counted) {
      field.appendChild(DataManager.direction(habit.type) === 'tally'
        ? this.screenTally()
        : this.screenTarget(habit, index, redraw));
    } else {
      field.appendChild(this.screenSays('One tap and it is done.'));
    }

    return field;
  }

  // Neutral counts and does not finish. There is nothing to reach, so there is
  // no number to set - which is the whole reason neutral needs no choice
  // between a goal and a limit.
  screenTally() {
    return this.screenSays('Counts up. There is nothing to reach.');
  }

  screenTarget(habit, index, redraw) {
    const wrap = document.createElement('div');

    const word = TARGET_WORD[habit.type];
    const goal = Number(habit.goal) > 0 ? Number(habit.goal) : 1;

    const stepper = document.createElement('div');
    stepper.className = 'habit-screen-stepper';

    const set = (next) => {
      this.dataManager.updateHabit(index, habit.name, habit.type, Math.max(1, next), true);
      redraw();
    };

    const minus = document.createElement('button');
    minus.className = 'habit-screen-step';
    minus.textContent = '−';
    minus.title = `One less than the ${word.toLowerCase()}`;
    minus.disabled = goal <= 1;
    minus.onclick = () => set(goal - 1);

    const value = document.createElement('b');
    value.textContent = String(goal);

    const plus = document.createElement('button');
    plus.className = 'habit-screen-step';
    plus.textContent = '+';
    plus.title = `One more than the ${word.toLowerCase()}`;
    plus.onclick = () => set(goal + 1);

    const unit = document.createElement('span');
    unit.className = 'habit-screen-unit';
    unit.textContent = 'a day';

    const heading = document.createElement('span');
    heading.className = 'habit-screen-word';
    heading.textContent = word;

    stepper.appendChild(heading);
    stepper.appendChild(minus);
    stepper.appendChild(value);
    stepper.appendChild(plus);
    stepper.appendChild(unit);

    wrap.appendChild(stepper);
    wrap.appendChild(this.screenSays(DataManager.direction(habit.type) === 'limit'
      ? `Fine until you pass ${goal}.`
      : `Done when you reach ${goal}.`));
    return wrap;
  }

  screenSays(text) {
    const says = document.createElement('p');
    says.className = 'habit-screen-says';
    says.textContent = text;
    return says;
  }

  screenDelete(habit, index, close) {
    const remove = document.createElement('button');
    remove.className = 'habit-screen-delete';
    remove.textContent = 'Delete habit';
    remove.onclick = () => {
      if (confirm(`Delete "${habit.name}"?`)) {
        this.dataManager.deleteHabit(index);
        close();
      }
    };
    return remove;
  }

  createDragHandle() {
    const dragHandle = document.createElement('div');
    dragHandle.title = 'Drag to reorder';
    dragHandle.textContent = '⠿';
    dragHandle.className = 'drag-handle';
    return dragHandle;
  }

  // Which row a pointer is over. Pure, because the one thing this file needs
  // proving is the arithmetic: a touch drag cannot be driven by the screenshot
  // harness or by the DOM stub, so the browser half is verified by hand and
  // this half is verified by the suite.
  static rowUnder(rows, pointerY) {
    if (!rows.length) return null;
    for (const row of rows) {
      if (pointerY >= row.top && pointerY <= row.bottom) return row.index;
    }
    // Past either end, the nearest row is the answer - dragging above the
    // first row means the top, not nothing
    return pointerY < rows[0].top ? rows[0].index : rows[rows.length - 1].index;
  }


  createNameDisplay(habit, index) {
    const display = document.createElement('div');
    display.className = 'habit-name-display';
    
    const emoji = EmojiUtils.extractEmoji(habit.name);
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
    
    display.onclick = () => this.openHabitScreen(index);
    
    return display;
  }

  createHabitControls(habit, index) {
    const controls = document.createElement('div');
    controls.className = 'habit-controls';
    
    // What counting this habit does, as text rather than a control. The row
    // stays a row; the screen behind the name is where it is changed.
    const summary = HabitManager.countSummary(habit);
    if (summary) {
      const note = document.createElement('span');
      note.className = 'habit-count-note';
      note.textContent = summary;
      controls.appendChild(note);
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
  


  // Pointer events, not HTML5 drag and drop. Dragging a habit did nothing at
  // all on a phone: dragstart/dragover/drop never fire for touch, and this app
  // is used on a phone. Pointer events cover mouse and touch in one path.
  //
  // The grip starts the drag rather than the whole row, so the list still
  // scrolls under a finger - and because the grip is what the app's own
  // tooltip has always pointed at.
  addDragHandlers(wrapper, index) {
    const handle = wrapper.querySelector('.drag-handle');
    if (!handle || !window.PointerEvent) return;

    handle.addEventListener('pointerdown', (event) => {
      // Or the browser takes the gesture for scrolling and the drag dies
      event.preventDefault();

      const list = wrapper.parentNode;
      const startY = event.clientY;
      let target = index;

      // Measured once at the start: the rows do not move during the drag, only
      // the dragged one does, and re-reading them mid-gesture would chase it
      const rows = [...list.querySelectorAll('.manage-item')].map(element => {
        const rect = element.getBoundingClientRect();
        return { element, index: Number(element.dataset.index), top: rect.top, bottom: rect.bottom };
      });

      const mark = () => rows.forEach(row => {
        row.element.classList.toggle('drop-target', row.index === target && row.element !== wrapper);
      });

      const onMove = (moveEvent) => {
        wrapper.style.transform = `translateY(${moveEvent.clientY - startY}px)`;
        target = HabitManager.rowUnder(rows, moveEvent.clientY);
        mark();
      };

      const onEnd = (endEvent) => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onCancel);
        wrapper.style.transform = '';
        wrapper.classList.remove('dragging');
        rows.forEach(row => row.element.classList.remove('drop-target'));

        if (endEvent.type === 'pointerup' && target !== null && target !== index) {
          this.dataManager.reorderHabits(index, target);
          this.renderForm();
          this.notifyHabitsChanged();
        }
      };

      const onCancel = (cancelEvent) => onEnd(cancelEvent);

      wrapper.classList.add('dragging');
      // Capture, so the gesture keeps reporting once the finger leaves the grip
      handle.setPointerCapture(event.pointerId);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onCancel);
    });
  }

  renderForm() {
    this.clearElement(this.formElement);
    
    const habits = this.dataManager.getHabits();
    const groupedHabits = this.groupHabitsByType(habits);
    
    // Same order as the habit buttons under the calendar: good and bad at
    // opposite ends with neutral between
    const typeOrder = ['good', 'neutral', 'bad'];
    const typeLabels = {
      good: 'Good Habits',
      bad: 'Bad Habits',
      neutral: 'Neutral Habits'
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

    this.reserveTallestTabHeight(contentWrapper);
  }

  // Every tab reserves the height of the fullest one. Without this the dialog
  // resizes as you move between types - three good habits then none neutral -
  // and the tab strip jumps out from under the pointer mid-click.
  reserveTallestTabHeight(contentWrapper) {
    // Cleared first, or the previous reservation stretches the active tab and
    // the measurement ratchets upwards on every render
    contentWrapper.style.minHeight = '';

    let tallest = 0;

    for (const content of [...contentWrapper.children]) {
      if (content.classList.contains('active')) {
        tallest = Math.max(tallest, content.scrollHeight || 0);
        continue;
      }

      // Measured with the active styling, since that is what carries the
      // padding, and lifted out of the flex flow so it neither disturbs the
      // visible tab nor gets its height constrained by it
      content.classList.add('active');
      content.style.position = 'absolute';
      content.style.visibility = 'hidden';
      content.style.left = '0';
      content.style.right = '0';
      content.style.height = 'auto';

      tallest = Math.max(tallest, content.scrollHeight || 0);

      content.classList.remove('active');
      content.style.position = '';
      content.style.visibility = '';
      content.style.left = '';
      content.style.right = '';
      content.style.height = '';
    }

    // Never reserve more than the dialog can actually give. min-height does not
    // yield to flex shrinking, so a reservation taller than the available space
    // pushes the wrapper past the modal, which clips it - and the tab content
    // then never gets a constrained height to scroll inside.
    contentWrapper.style.minHeight = tallest ? `${Math.min(tallest, this.availableHeight(contentWrapper))}px` : '';
  }

  availableHeight(contentWrapper) {
    const content = this.modalElement.querySelector('.modal-content');
    if (!content) {
      return Infinity;
    }

    // Everything in the dialog that is not the tab area: header, tabs, footer
    const chrome = content.clientHeight - contentWrapper.clientHeight;
    const margin = 32; // .modal padding, matching max-height: calc(100dvh - 2rem)

    return Math.max(0, (window.innerHeight || 0) - margin - chrome);
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
    tabsContainer.setAttribute('role', 'tablist');
    
    typeOrder.forEach(type => {
      const tab = document.createElement('button');
      tab.className = `habit-tab ${type}`;
      tab.appendChild(document.createTextNode(TYPE_TABS[type]));

      const habitCount = groupedHabits[type] ? groupedHabits[type].length : 0;
      if (habitCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'habit-tab-count';
        badge.textContent = habitCount;
        tab.appendChild(badge);
      }

      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(type === this.activeTab));
      tab.setAttribute('aria-label', `${typeLabels[type]}, ${habitCount}`);

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
    
    // Rendered for every tab rather than only the active one, so that the
    // height each tab reserves is measured with it included. Only the active
    // tab is ever displayed, so the others cost nothing but a few nodes.
    content.appendChild(this.createAddHabitSection(type));
    
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

  // Tab, Shift+Tab and Escape have to be handled here: a dialog that leaks focus
  // to the page behind it is unusable with a keyboard or a screen reader
  handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [...this.modalElement.querySelectorAll(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  notifyHabitsChanged() {
    if (this.onHabitsChanged) {
      this.onHabitsChanged();
    }
  }

  open() {
    this.previouslyFocused = document.activeElement;
    this.modalElement.style.display = 'flex';
    this.renderForm();

    // Focus the dialog, not the name field. Focusing a text input raises the
    // on-screen keyboard the moment the dialog opens, which covers most of the
    // habit list it was opened to look at. Adding a habit still returns focus
    // to the field, because by then the keyboard is wanted.
    const dialog = this.modalElement.querySelector('.modal-content');
    if (dialog) {
      dialog.focus();
    }
  }

  close() {
    this.closeHabitScreen();
    this.modalElement.style.display = 'none';

    // Back to whatever opened it, rather than dumping focus on the body
    if (this.previouslyFocused && this.previouslyFocused.focus) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;
  }
}