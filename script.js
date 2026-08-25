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
const backupManager = new BackupManager(dataManager);

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

// --- local backups ---------------------------------------------------------
// localStorage is the only copy of this history and a browser may evict it, so
// ask for persistent storage and keep rolling snapshots that survive a bad
// import or a deleted habit. Off-device backup is still export.
backupManager.requestPersistence();

dataManager.onChanged = () => backupManager.scheduleSnapshot();
importExportManager.beforeReplace = () => backupManager.snapshot('before import');

// The snapshot is debounced, so a tab being hidden or closed is the last chance
// to capture what just happened
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    backupManager.flush();
  }
});

const restorePanel = document.getElementById('restore-panel');
const manageForm = document.getElementById('manage-form');

function showRestorePanel(show) {
  restorePanel.hidden = !show;
  manageForm.hidden = show;

  if (show) {
    backupManager.renderInto(
      document.getElementById('restore-list'),
      document.getElementById('restore-storage'),
      result => {
        showRestorePanel(false);
        habitManager.renderForm();
        habitsView.render();
        calendarView.render();
        importExportManager.showMessage(result.message, result.success ? 'success' : 'error');
        if (result.success) {
          habitManager.close();
        }
      }
    );
  }
}

document.getElementById('restore-button').onclick = () => showRestorePanel(true);
document.getElementById('restore-back').onclick = () => showRestorePanel(false);

// Opening settings always lands on the habit list, never on a panel left open
habitManager.onOpened = () => showRestorePanel(false);

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