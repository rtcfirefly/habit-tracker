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

// --- the day sheet --------------------------------------------------------
// Where a day is edited in both directions. The buttons under the calendar
// only add; this is where anything comes back off.
const daySheet = new DaySheet(dataManager);
daySheet.onChanged = () => {
  calendarView.render();
  habitsView.render();
};

calendarView.onDayReopened = (dateKey) => daySheet.open(dateKey);

// --- about ----------------------------------------------------------------
// Replaces the dialog's body rather than adding another row to it. The dialog
// already carries tabs, a list and three settings rows, and this is read once.
const aboutPanel = document.getElementById('modal-about');
const modalBody = document.querySelector('.modal-body');

const modalTitle = document.getElementById('manage-modal-title');

function showAbout(show) {
  aboutPanel.hidden = !show;
  modalBody.hidden = show;
  // The dialog is labelled by this heading, so it has to say which of the two
  // views is actually on screen
  modalTitle.textContent = show ? 'About' : 'Manage Habits';

  // The panel rather than the Back button: focus has to move into the new view
  // for a screen reader, and a ring drawn on a control nobody tabbed to reads
  // as damage
  (show ? aboutPanel : document.getElementById('about-button')).focus();
}

// The guide is otherwise unreachable once there is a habit, which is the same
// moment it stops appearing on its own - so the only way back to it has to be
// somewhere deliberate rather than in the reader's way
document.getElementById('about-guide').onclick = () => {
  showAbout(false);
  habitManager.close();
  // No onClose: the spotlight exists to get a first habit added, and someone
  // who found this button has already been through the settings dialog
  new Intro().open();
};

document.getElementById('about-button').onclick = () => showAbout(true);
document.getElementById('about-back').onclick = () => showAbout(false);

// Reopening settings should land on the habits, not wherever it was left
document.getElementById('manage-habits-button').addEventListener('click', () => showAbout(false));

// --- the weekly backup reminder -------------------------------------------
// A paused backup cannot resume itself, so the most that can be automated is
// asking. This appears in the main view rather than in settings, because not
// opening settings is the entire problem it exists to solve.
const nudge = document.getElementById('backup-nudge');
const nudgeText = document.getElementById('backup-nudge-text');
const nudgeAction = document.getElementById('backup-nudge-action');

const remindToggle = document.getElementById('backup-remind-toggle');

function renderNudge() {
  const last = FileBackup.lastBackup();
  const show = FileBackup.remindersEnabled
    && FileBackup.shouldRemind(last, FileBackup.snoozedUntil);
  nudge.hidden = !show;
  if (show) {
    nudgeText.textContent = FileBackup.reminderText(last);
  }
}

nudgeAction.onclick = async () => {
  // Resume the file backup where there is one to resume, otherwise fall back to
  // export, which is the only route Firefox has
  if (fileBackup.state === 'needs-tap' || fileBackup.state === 'on') {
    try {
      await fileBackup.resume();
    } catch (error) {
      if (error && error.name !== 'AbortError') {
        importExportManager.showMessage(`Backup failed: ${error.message}`, 'error');
      }
    }
  } else {
    importExportManager.exportData();
  }
  renderNudge();
};

// Dismiss snoozes rather than disables, because the data is what is being
// protected here. Turning it off for good is the checkbox in settings, which
// is a deliberate act rather than a reflex tap on an X.
document.getElementById('backup-nudge-dismiss').onclick = () => {
  FileBackup.snooze();
  renderNudge();
};

remindToggle.checked = FileBackup.remindersEnabled;
remindToggle.onchange = () => {
  FileBackup.setRemindersEnabled(remindToggle.checked);
  renderNudge();
};

// --- write-through backup to a chosen file --------------------------------
// Only where the File System Access API exists. The row shows its state at all
// times because this pauses itself each session, and a backup that has silently
// stopped is worse than none.
const fileBackup = new FileBackup(dataManager);
const backupRow = document.getElementById('file-backup');
const backupLabel = document.getElementById('file-backup-label');
const backupAction = document.getElementById('file-backup-action');

function renderBackupRow(state, lastWritten) {
  const { label, action } = FileBackup.describe(state, lastWritten);
  backupRow.hidden = state === 'unsupported';
  backupRow.classList.toggle('paused', state === 'needs-tap' || state === 'error');
  backupLabel.textContent = label;
  backupAction.hidden = !action;
  backupAction.textContent = action || '';
}

fileBackup.onStateChange = (state, lastWritten) => {
  renderBackupRow(state, lastWritten);
  renderNudge();
};

backupAction.onclick = async () => {
  const previous = backupAction.textContent;
  backupAction.textContent = '…';
  try {
    await (fileBackup.state === 'needs-tap' ? fileBackup.resume() : fileBackup.choose());
  } catch (error) {
    // Dismissing the picker is a choice, not a failure worth shouting about
    if (error && error.name !== 'AbortError') {
      importExportManager.showMessage(`Could not set up file backup: ${error.message}`, 'error');
    }
    backupAction.textContent = previous;
  }
  renderBackupRow(fileBackup.state, fileBackup.lastWritten);
};

dataManager.onChanged = () => fileBackup.schedule();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    fileBackup.flush();
  }
});

renderBackupRow(fileBackup.state, fileBackup.lastWritten);
renderNudge();
fileBackup.load();

// The explainer covers things the interface cannot say for itself - most of
// all that no habit button does anything until a day is selected, which
// otherwise reads as a broken app. Opened last so it lands on top of a page
// that has already rendered behind it.
if (Intro.shouldShow(dataManager)) {
  const intro = new Intro();
  // The guide ends by dimming the app around the gear and waiting. Opening
  // settings for them would skip the one gesture the whole app depends on,
  // and they would be left in a dialog they did not ask for and have not been
  // shown the way back into.
  intro.onClose = (finished) => {
    if (finished) {
      new Spotlight(document.getElementById('manage-habits-button')).show();
    }
  };
  intro.open();
}

// localStorage is the only copy of this history, so ask the browser not to
// evict it under storage pressure. No UI, and unrelated to export: it protects
// against the browser deciding, not against a person clearing site data.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then(already => (already ? true : navigator.storage.persist()))
    .catch(() => {});
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