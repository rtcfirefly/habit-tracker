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

// Export and import live inside the manage modal now; close it so the success
// or failure message is not hidden behind it. Appearance deliberately does not
// close, so the theme can be judged against the calendar underneath.
['export-button', 'import-button'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => habitManager.close());
});

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

// Register the service worker so the app keeps working offline.
//
// Not while developing, though: a worker on localhost serves the previous copy
// of every file, so a reload after an edit shows the old app. Any worker a
// previous visit left behind is cleared out too, since skipping registration
// does not remove one that is already installed. Append ?sw=1 to test the
// worker itself locally.
const DEV_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];
const workerWanted = !DEV_HOSTS.includes(location.hostname)
  || new URLSearchParams(location.search).get('sw') === '1';

if ('serviceWorker' in navigator) {
  if (workerWanted) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(error => {
        console.error('Service worker registration failed:', error);
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(r => r.unregister()))
      .catch(() => {});

    if (window.caches) {
      caches.keys().then(keys => keys.forEach(key => caches.delete(key))).catch(() => {});
    }
  }
}

// Initialize the application
habitsView.setSelectedDate(calendarView.getSelectedDate());
calendarView.render();
habitsView.render();