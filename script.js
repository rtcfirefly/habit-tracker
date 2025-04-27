let habits = JSON.parse(localStorage.getItem('habits') || '[]');
let completions = JSON.parse(localStorage.getItem('completions') || '{}');

const calendar = document.getElementById('calendar');
const habitsList = document.getElementById('habits-list');
const manageModal = document.getElementById('manage-modal');
const manageForm = document.getElementById('manage-form');
const monthYear = document.getElementById('month-year');

let currentDate = new Date();
let selectedDate = new Date().toDateString();
let dragStartIndex;

function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function saveData() {
  localStorage.setItem('habits', JSON.stringify(habits));
  localStorage.setItem('completions', JSON.stringify(completions));
}

function getMonthDays(year, month) {
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

function renderCalendar() {
  while (calendar.firstChild) {
    calendar.removeChild(calendar.firstChild);
  }

  const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
  monthYear.textContent = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // If selectedDate is not in the current month, clear it
  if (new Date(selectedDate).getMonth() !== currentDate.getMonth() ||
      new Date(selectedDate).getFullYear() !== currentDate.getFullYear()) {
    selectedDate = null;
  }

  days.forEach(day => {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    const dayKey = day.toDateString();

    const dateText = document.createElement('div');
    dateText.textContent = day.getDate();
    dayDiv.appendChild(dateText);

    if (day.getMonth() !== currentDate.getMonth()) dayDiv.classList.add('other-month');
    if (isSameDay(day, new Date())) dayDiv.classList.add('today');
    if (dayKey === selectedDate) dayDiv.classList.add('selected');

    const doneHabits = completions[dayKey] || [];
    doneHabits.forEach(habitName => {
      const habit = habits.find(h => h.name === habitName);
      if (habit) {
        const dot = document.createElement('div');
        dot.className = `habit-dot ${habit.type}`;
        dayDiv.appendChild(dot);
      }
    });

    dayDiv.addEventListener('click', () => {
      selectedDate = dayKey;
      renderHabits();
      renderCalendar();
    });

    calendar.appendChild(dayDiv);
  });
}

function renderHabits() {
  while (habitsList.firstChild) {
    habitsList.removeChild(habitsList.firstChild);
  }

  if (habits.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.style.textAlign = 'center';
    placeholder.style.color = '#888';
    placeholder.textContent = 'No habits yet. Click "Manage Habits" to add some!';
    habitsList.appendChild(placeholder);
    return;
  }

  habits.forEach(habit => {
    const button = document.createElement('button');
    button.className = `habit-button ${habit.type}`;
    button.textContent = habit.name;

    if (selectedDate) {
      if (!completions[selectedDate]) completions[selectedDate] = [];
      if (completions[selectedDate].includes(habit.name)) {
        button.classList.add('completed');
      }
    }

    button.addEventListener('click', () => {
      if (!selectedDate) return;
      const index = completions[selectedDate].indexOf(habit.name);
      if (index === -1) {
        completions[selectedDate].push(habit.name);
      } else {
        completions[selectedDate].splice(index, 1);
      }
      saveData();
      renderHabits();
      renderCalendar();
    });

    habitsList.appendChild(button);
  });
}

function renderManageForm() {
  while (manageForm.firstChild) {
    manageForm.removeChild(manageForm.firstChild);
  }
  const addWrapper = document.createElement('div');
  addWrapper.className = 'manage-item';
  const newNameInput = document.createElement('input');
  newNameInput.placeholder = 'New habit name';
  const newTypeSelect = document.createElement('select');
  ['good', 'bad', 'neutral'].forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.text = type;
    newTypeSelect.appendChild(option);
  });
  const addButton = document.createElement('button');
  addButton.innerText = '➕';
  addButton.onclick = () => {
    const name = newNameInput.value.trim();
    const type = newTypeSelect.value;
    if (name) {
      habits.push({ name, type });
      saveData();
      renderManageForm();
      renderHabits();
      renderCalendar();
      newNameInput.value = '';
    }
  };
  addWrapper.appendChild(newNameInput);
  addWrapper.appendChild(newTypeSelect);
  addWrapper.appendChild(addButton);
  manageForm.appendChild(addWrapper);

  habits.forEach((habit, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `manage-item ${habit.type}`;
    wrapper.draggable = true;
    const dragHandle = document.createElement('div');
    dragHandle.innerText = '☰';
    dragHandle.className = 'drag-handle';
    const input = document.createElement('input');
    input.value = habit.name;
    input.onchange = (e) => { habit.name = e.target.value; saveData(); renderHabits(); renderCalendar(); };
    const select = document.createElement('select');
    ['good', 'bad', 'neutral'].forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.text = type;
      if (habit.type === type) option.selected = true;
      select.appendChild(option);
    });
    select.onchange = (e) => { habit.type = e.target.value; saveData(); renderHabits(); renderCalendar(); };
    const deleteButton = document.createElement('button');
    deleteButton.innerText = '❌';
    deleteButton.onclick = () => {
      if (confirm('Delete this habit?')) {
        habits.splice(index, 1);
        saveData();
        renderManageForm();
        renderHabits();
        renderCalendar();
      }
    };
    wrapper.appendChild(dragHandle);
    wrapper.appendChild(input);
    wrapper.appendChild(select);
    wrapper.appendChild(deleteButton);

    wrapper.addEventListener('dragstart', () => {
      dragStartIndex = index;
      wrapper.classList.add('dragging');
    });
    wrapper.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
    });
    wrapper.addEventListener('dragover', (e) => e.preventDefault());
    wrapper.addEventListener('drop', () => {
      const draggedItem = habits.splice(dragStartIndex, 1)[0];
      habits.splice(index, 0, draggedItem);
      saveData();
      renderManageForm();
      renderHabits();
    });

    manageForm.appendChild(wrapper);
  });
}

function openManageModal() {
  manageModal.style.display = 'flex';
  renderManageForm();
}

function closeManageModal() {
  manageModal.style.display = 'none';
}

document.getElementById('manage-habits-button').onclick = openManageModal;
document.getElementById('prev-month').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
};
document.getElementById('next-month').onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
};

// New: Close modal when clicking outside modal-content
manageModal.addEventListener('click', (e) => {
  if (e.target === manageModal) {
    closeManageModal();
  }
});
// --- Theme Toggle ---
const themeToggleButton = document.getElementById('theme-toggle-button');

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleButton.innerText = '☀️ Light Mode';
  } else {
    document.body.classList.remove('dark-mode');
    themeToggleButton.innerText = '🌙 Dark Mode';
  }
  localStorage.setItem('theme', theme);
}

themeToggleButton.onclick = () => {
  const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
};

// Load theme on page load
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

renderCalendar();
renderHabits();
