// Write-through backup into a file you choose once.
//
// Where the File System Access API exists, a handle can be kept and rewritten
// later without picking the file again. Pointing it at a Google Drive location
// makes it real off-device backup - the thing export has always required a
// deliberate tap for.
//
// Whether it needs a tap each session depends on how the app is opened. Chrome
// persists these permissions automatically for installed apps, so in the
// installed PWA a granted handle stays granted; in an ordinary browser tab it
// comes back as "prompt" and needs one tap to resume. Measured in a tab first,
// which is how this was initially mistaken for always needing a tap.
//
// Either way a backup that has quietly stopped is worse than none, so the state
// is always shown rather than assumed.

const HANDLE_DB = 'habit-tracker-file-backup';
const HANDLE_KEY = 'handle';
const LAST_WRITTEN_KEY = 'fileBackupLastWritten';
const LAST_EXPORTED_KEY = 'lastExported';
const SNOOZE_KEY = 'backupReminderSnoozedUntil';
const REMINDERS_OFF_KEY = 'backupRemindersOff';
const REMIND_AFTER_DAYS = 7;
const SNOOZE_DAYS = 3;
const WRITE_DELAY = 5000;

class FileBackup {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.handle = null;
    this.permission = null;
    this.pending = null;
    this.onStateChange = null;
    this.lastError = null;
  }

  static get supported() {
    return typeof window !== 'undefined' &&
           typeof window.showSaveFilePicker === 'function' &&
           typeof indexedDB !== 'undefined';
  }

  // Pure, so the wording can be tested without a browser
  static get standalone() {
    return typeof window !== 'undefined' && window.matchMedia &&
           window.matchMedia('(display-mode: standalone)').matches;
  }

  static describe(state, lastWritten, now = Date.now(), standalone = FileBackup.standalone) {
    if (state === 'unsupported') {
      return { label: 'Not available in this browser', action: null };
    }
    if (state === 'off') {
      return { label: 'Not backing up to a file', action: 'Choose file' };
    }
    if (state === 'needs-tap') {
      // Installed apps keep the permission; a plain tab does not, and saying so
      // turns a recurring annoyance into something the person can act on
      return {
        label: standalone ? 'Paused — tap to resume'
                          : 'Paused — install the app to keep this on',
        action: 'Resume'
      };
    }
    if (state === 'error') {
      return { label: 'Last write failed', action: 'Choose file' };
    }

    if (!lastWritten) {
      return { label: 'On — nothing written yet', action: 'Change' };
    }

    const minutes = Math.floor((now - lastWritten) / 60000);
    const when = minutes < 1 ? 'just now'
      : minutes < 60 ? `${minutes} minute${minutes === 1 ? '' : 's'} ago`
      : minutes < 1440 ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) === 1 ? '' : 's'} ago`
      : `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) === 1 ? '' : 's'} ago`;

    return { label: `On — written ${when}`, action: 'Change' };
  }

  // --- the weekly reminder ------------------------------------------------
  // Nothing can re-arm a paused backup on its own: requestPermission needs a
  // user gesture, and periodic background sync could not supply one even where
  // it exists. So the most that can be automated is asking, in the place the
  // person already is, and only when it has actually been a while.
  static lastBackup() {
    const written = Number(localStorage.getItem(LAST_WRITTEN_KEY)) || 0;
    const exported = Number(localStorage.getItem(LAST_EXPORTED_KEY)) || 0;
    return Math.max(written, exported) || null;
  }

  static recordExport(at = Date.now()) {
    localStorage.setItem(LAST_EXPORTED_KEY, String(at));
  }

  static snooze(now = Date.now()) {
    localStorage.setItem(SNOOZE_KEY, String(now + SNOOZE_DAYS * 86400000));
  }

  // Pure: the whole decision, so it can be tested without a browser
  static shouldRemind(lastBackup, snoozedUntil, now = Date.now(), afterDays = REMIND_AFTER_DAYS) {
    if (snoozedUntil && now < snoozedUntil) {
      return false;
    }
    // Never backed up is worth saying too, but not on the very first run - the
    // first change is what creates something worth keeping
    if (!lastBackup) {
      return false;
    }
    return now - lastBackup >= afterDays * 86400000;
  }

  static reminderText(lastBackup, now = Date.now()) {
    const days = Math.floor((now - lastBackup) / 86400000);
    return `Last backed up ${days} day${days === 1 ? '' : 's'} ago`;
  }

  static get snoozedUntil() {
    return Number(localStorage.getItem(SNOOZE_KEY)) || null;
  }

  // Off is the stored state, so the default stays on for anyone who has never
  // touched the setting - including everyone upgrading, who has no key at all
  static get remindersEnabled() {
    return localStorage.getItem(REMINDERS_OFF_KEY) !== '1';
  }

  static setRemindersEnabled(enabled) {
    if (enabled) {
      // Clearing the snooze too, so turning reminders back on does not land in
      // a three day silence the person cannot see or explain
      localStorage.removeItem(REMINDERS_OFF_KEY);
      localStorage.removeItem(SNOOZE_KEY);
    } else {
      localStorage.setItem(REMINDERS_OFF_KEY, '1');
    }
  }

  // --- handle storage ----------------------------------------------------
  store(mode) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(HANDLE_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('handles');
      open.onsuccess = () => resolve(open.result.transaction('handles', mode).objectStore('handles'));
      open.onerror = () => reject(open.error);
    });
  }

  static request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async load() {
    if (!FileBackup.supported) {
      return;
    }
    try {
      this.handle = await FileBackup.request((await this.store('readonly')).get(HANDLE_KEY));
      if (this.handle) {
        this.permission = await this.handle.queryPermission({ mode: 'readwrite' });
      }
    } catch (error) {
      this.handle = null;
    }
    this.announce();
  }

  get lastWritten() {
    return Number(localStorage.getItem(LAST_WRITTEN_KEY)) || null;
  }

  get state() {
    if (!FileBackup.supported) return 'unsupported';
    if (this.lastError) return 'error';
    if (!this.handle) return 'off';
    return this.permission === 'granted' ? 'on' : 'needs-tap';
  }

  announce() {
    if (this.onStateChange) {
      this.onStateChange(this.state, this.lastWritten);
    }
  }

  // --- actions (each needs a user gesture) --------------------------------
  async choose() {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'habit-tracker-backup.json',
      types: [{ description: 'Habit Tracker backup', accept: { 'application/json': ['.json'] } }]
    });

    this.handle = handle;
    this.permission = 'granted';
    this.lastError = null;
    await FileBackup.request((await this.store('readwrite')).put(handle, HANDLE_KEY));
    await this.write();
    return this.state;
  }

  async resume() {
    if (!this.handle) {
      return this.state;
    }
    this.permission = await this.handle.requestPermission({ mode: 'readwrite' });
    this.lastError = null;
    if (this.permission === 'granted') {
      await this.write();
    }
    this.announce();
    return this.state;
  }

  // --- writing ------------------------------------------------------------
  async write() {
    if (!this.handle || this.permission !== 'granted') {
      return false;
    }
    try {
      const writable = await this.handle.createWritable();
      await writable.write(this.dataManager.exportData());
      await writable.close();
      localStorage.setItem(LAST_WRITTEN_KEY, String(Date.now()));
      localStorage.removeItem(SNOOZE_KEY);
      this.lastError = null;
    } catch (error) {
      // The file may have been moved, deleted, or permission withdrawn
      this.lastError = error;
      this.permission = null;
    }
    this.announce();
    return !this.lastError;
  }

  // Settles rather than writing on every tap, and a hidden tab is the last
  // chance to capture what just happened
  schedule() {
    if (this.state !== 'on') {
      return;
    }
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.write(), WRITE_DELAY);
  }

  flush() {
    clearTimeout(this.pending);
    return this.state === 'on' ? this.write() : Promise.resolve(false);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FileBackup };
}
