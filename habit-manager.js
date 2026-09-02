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

      // Naming it is the first half of making it; whether it counts, and to
      // what, is the other half. That used to be a screen this opened for you.
      // The row is the screen now, so the new row's count takes the cursor -
      // the one thing still unsaid about the habit.
      const rows = this.formElement.querySelectorAll('.manage-item');
      const last = rows[rows.length - 1];
      const cell = last && last.querySelector('.habit-count-cell');
      if (cell && cell.onclick) cell.onclick();
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
    const countCell = this.createCountCell(habit, index);
    const controls = this.createHabitControls(habit, index);
    
    content.appendChild(dragHandle);
    content.appendChild(nameDisplay);
    content.appendChild(countCell);
    content.appendChild(controls);
    
    wrapper.appendChild(content);
    
    this.addDragHandlers(wrapper, index);
    
    return wrapper;
  }

  // Back out one layer. The dialog is the only layer now: a habit is edited
  // where it sits, so there is nothing inside it to leave first.
  dismiss() {
    this.close();
  }

  // Text until you touch it.
  //
  // The row is the editor. Tapping a name or a count swaps that one element
  // for an input of the same size in the same place, so nothing moves under a
  // thumb already on its way down, and the list at rest stays a list rather
  // than a column of boxes.
  //
  // Enter commits and Escape reverts. Blur commits too, because tapping
  // elsewhere is what people do, and throwing away what they typed for it is
  // indefensible.
  static editInPlace(span, { numeric, commit }) {
    span.tabIndex = 0;

    const open = () => {
      const input = document.createElement('input');
      input.className = span.className.replace(' empty', '') + ' editing';
      input.value = span.dataset.raw || '';
      if (numeric) {
        // The numeric keypad, not the number spinner: type="number" brings
        // arrows nobody wants on a row this narrow and refuses to be styled.
        input.type = 'text';
        input.inputMode = 'numeric';
      }
      span.replaceWith(input);
      if (input.focus) input.focus();
      if (input.select) input.select();

      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const typed = input.value.trim();
        // The span goes back before commit(), because commit() re-renders the
        // list and would otherwise be reading a DOM with a stray input in it
        input.replaceWith(span);
        if (save) commit(typed);
      };
      input.onblur = () => finish(true);
      input.onkeydown = (event) => {
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      };
    };

    span.onclick = open;
    span.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    };
    return span;
  }

  // The number is the switch.
  //
  // A figure in the cell means the habit counts to that figure. An empty cell
  // means it does not count at all, drawn as a faint dash because an empty box
  // on a row reads as a rendering fault rather than as a state. There is no
  // second control, which is the point: the screen this replaced carried an
  // Once/Counts segment and a stepper, two controls saying what one number
  // says by being there or not.
  //
  // Clearing it is not destructive. updateHabit keeps the goal it was last
  // given and only stops the counting, so a number cleared by a stray
  // backspace is still there when counting is turned back on.
  createCountCell(habit, index) {
    const cell = document.createElement('span');
    cell.className = 'habit-count-cell';

    const after = () => {
      this.renderForm();
      this.notifyHabitsChanged();
    };

    // A neutral habit tallies and is never finished - direction() says tally
    // and hasTarget() refuses it - so it has no figure to hold. Its cell keeps
    // the column's width and place and carries a tick instead. One column with
    // two mechanics is the honest cost of putting this on a single line.
    if (DataManager.direction(habit.type) === 'tally') {
      const on = DataManager.isCounted(habit);
      cell.classList.add('is-toggle');
      if (!on) cell.classList.add('empty');
      cell.textContent = on ? '✓' : '–';
      cell.title = on ? 'Counts. Tap to stop counting.' : 'Does not count. Tap to count.';
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-pressed', String(on));
      cell.setAttribute('aria-label', `${habit.name}: counting`);
      cell.tabIndex = 0;

      const flip = () => {
        this.dataManager.updateHabit(index, habit.name, habit.type, null, !on);
        after();
      };
      cell.onclick = flip;
      cell.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); }
      };
      return cell;
    }

    const target = DataManager.hasTarget(habit) ? String(habit.goal) : '';
    cell.dataset.raw = target;
    cell.textContent = target || '–';
    if (!target) cell.classList.add('empty');

    // A goal of 3 and a limit of 3 are the same three characters on the row,
    // and only the tab you are on tells them apart. The label says which.
    const word = TARGET_WORD[habit.type] || 'Goal';
    cell.setAttribute('aria-label', target
      ? `${habit.name}: ${word.toLowerCase()} ${target}`
      : `${habit.name}: no ${word.toLowerCase()}, does not count`);
    cell.title = `${word} — leave it empty for a single tap`;

    return HabitManager.editInPlace(cell, {
      numeric: true,
      commit: (text) => {
        const digits = text.replace(/[^0-9]/g, '');
        const next = Number(digits);
        // Empty, and a zero typed to mean empty, both mean it stops counting
        const counts = digits !== '' && next > 0;
        this.dataManager.updateHabit(index, habit.name, habit.type,
                                     counts ? next : null, counts);
        after();
      }
    });
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
    
    display.dataset.raw = habit.name;

    return HabitManager.editInPlace(display, {
      numeric: false,
      commit: (name) => {
        if (!name || name === habit.name) return;
        // A name already taken is refused by updateHabit and the row simply
        // redraws with the old one, rather than announcing it: the list is
        // right there and the habit it clashes with is visible in it
        if (this.dataManager.updateHabit(index, name, habit.type)) {
          this.renderForm();
          this.notifyHabitsChanged();
        }
      }
    });
  }

  createHabitControls(habit, index) {
    const controls = document.createElement('div');
    controls.className = 'habit-controls';
    
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

    // Back closes the dialog rather than the app. The habit screen pushes a
    // layer of its own on top, so back unwinds one place at a time - the same
    // order the X and Escape take.
    this.backClose = () => this.close();
    BackTrap.push(this.backClose);
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
    this.modalElement.style.display = 'none';
    BackTrap.remove(this.backClose);

    // Back to whatever opened it, rather than dumping focus on the body
    if (this.previouslyFocused && this.previouslyFocused.focus) {
      this.previouslyFocused.focus();
    }
    this.previouslyFocused = null;
  }
}