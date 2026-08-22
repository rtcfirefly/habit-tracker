// Initialize components and managers
const dataManager = new DataManager();
const calendarView = new CalendarView(
  document.getElementById('calendar'),
  document.getElementById('month-year'),
  dataManager
);
const habitsView = new HabitsView(
  document.getElementById('habits-list'),
  dataManager
);
const habitManager = new HabitManager(
  document.getElementById('manage-modal'),
  document.getElementById('manage-form'),
  dataManager
);
const themeManager = new ThemeManager(
  document.getElementById('theme-toggle-button')
);
const importExportManager = new ImportExportManager(dataManager);

// Set up event handlers between components
calendarView.onDateSelected = (dateKey) => {
  habitsView.setSelectedDate(dateKey);
  habitsView.render();
};

habitsView.onHabitToggled = () => {
  calendarView.render();
};

habitManager.onHabitsChanged = () => {
  habitsView.render();
  calendarView.render();
};

importExportManager.onDataChanged = () => {
  habitsView.render();
  calendarView.render();
};

// Set up navigation button handlers
document.getElementById('manage-habits-button').onclick = () => {
  habitManager.open();
};

document.getElementById('prev-month').onclick = () => {
  calendarView.goToPreviousMonth();
};

document.getElementById('next-month').onclick = () => {
  calendarView.goToNextMonth();
};

// Global function for modal close button
function closeManageModal() {
  habitManager.close();
}

// Register the service worker so the app keeps working offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.error('Service worker registration failed:', error);
    });
  });
}

// Initialize the application
habitsView.setSelectedDate(calendarView.getSelectedDate());
calendarView.render();
habitsView.render();