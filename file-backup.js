// Write-through backup into a file you choose once.
//
// Where the File System Access API exists, a handle can be kept and rewritten
// later without picking the file again. Pointing it at a Google Drive location
// makes it real off-device backup - the thing export has always required a
// deliberate tap for.
//
// It is not silent, and pretending otherwise would be the worst version of this
// feature. Chrome hands the handle back after a reload with permission set to
// "prompt", so each session needs one tap to resume. A backup that has quietly
// stopped is worse than none, so the state is always shown.

const HANDLE_DB = 'habit-tracker-file-backup';
const HANDLE_KEY = 'handle';
const LAST_WRITTEN_KEY = 'fileBackupLastWritten';
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
  static describe(state, lastWritten, now = Date.now()) {
    if (state === 'unsupported') {
      return { label: 'Not available in this browser', action: null };
    }
    if (state === 'off') {
      return { label: 'Not backing up to a file', action: 'Choose file' };
    }
    if (state === 'needs-tap') {
      return { label: 'Paused — this browser asks again each session', action: 'Resume' };
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
