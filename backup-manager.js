// Rolling local backups.
//
// localStorage is the only copy of a user's history and browsers are entitled
// to evict it under storage pressure, so this does two things: asks for
// persistent storage, and keeps snapshots in IndexedDB that survive a bad
// import, a deleted habit or a mistaken restore.
//
// It is durability, not off-device backup. Losing the device loses these too.

const BACKUP_DB = 'habit-tracker-backups';
const BACKUP_STORE = 'snapshots';

// Recent activity is what you are most likely to want back, older history only
// needs day-level resolution, and nothing should grow without bound.
const KEEP_RECENT = 10;
const KEEP_DAYS = 14;
const MAX_BYTES = 2 * 1024 * 1024;

class BackupManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
    this.pending = null;
    this.persisted = null;
  }

  // --- retention ---------------------------------------------------------
  // Pure so it can be tested without a database: keeps the newest few whatever
  // their age, then the newest of each earlier day, then trims to a byte cap.
  static selectForRetention(snapshots, now = Date.now()) {
    const newestFirst = [...snapshots].sort((a, b) => b.at - a.at);
    const keep = new Set(newestFirst.slice(0, KEEP_RECENT).map(s => s.id));

    const seenDays = new Set();
    const dayOf = at => new Date(at).toDateString();
    const oldestAllowed = now - KEEP_DAYS * 24 * 60 * 60 * 1000;

    for (const snapshot of newestFirst) {
      if (keep.has(snapshot.id) || snapshot.at < oldestAllowed) {
        continue;
      }
      const day = dayOf(snapshot.at);
      if (!seenDays.has(day)) {
        seenDays.add(day);
        keep.add(snapshot.id);
      }
    }

    let total = 0;
    const kept = [];
    for (const snapshot of newestFirst) {
      if (!keep.has(snapshot.id)) {
        continue;
      }
      total += snapshot.bytes || 0;
      if (total > MAX_BYTES && kept.length > 0) {
        break;
      }
      kept.push(snapshot);
    }

    return {
      keep: kept.map(s => s.id),
      drop: newestFirst.filter(s => !kept.some(k => k.id === s.id)).map(s => s.id)
    };
  }

  // --- storage -----------------------------------------------------------
  async requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) {
      this.persisted = null;
      return null;
    }
    try {
      this.persisted = await navigator.storage.persisted()
        ? true
        : await navigator.storage.persist();
    } catch (error) {
      this.persisted = null;
    }
    return this.persisted;
  }

  open() {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(BACKUP_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BACKUP_STORE)) {
          db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true })
            .createIndex('at', 'at');
        }
      };
      request.onsuccess = () => { this.db = request.result; resolve(this.db); };
      request.onerror = () => reject(request.error);
    });
  }

  transaction(mode) {
    return this.open().then(db => db.transaction(BACKUP_STORE, mode).objectStore(BACKUP_STORE));
  }

  static request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // --- snapshots ---------------------------------------------------------
  // An export embeds the moment it was taken, so two exports of identical data
  // are never byte-equal. Compare everything except that.
  static fingerprint(payload) {
    try {
      const parsed = JSON.parse(payload);
      delete parsed.exportDate;
      return JSON.stringify(parsed);
    } catch (error) {
      return payload;
    }
  }

  async snapshot(reason = 'change') {
    const payload = this.dataManager.exportData();
    const fingerprint = BackupManager.fingerprint(payload);
    const store = await this.transaction('readwrite');
    const existing = await BackupManager.request(store.getAll());

    // Nothing changed since the last one; another copy would only push an older
    // and more useful snapshot out of retention
    const newest = [...existing].sort((a, b) => b.at - a.at)[0];
    if (newest && newest.fingerprint === fingerprint) {
      return null;
    }

    const record = {
      at: Date.now(),
      reason,
      payload,
      fingerprint,
      bytes: payload.length,
      habits: this.dataManager.getHabits().length,
      days: Object.keys(this.dataManager.getCompletions()).length
    };

    await BackupManager.request(store.add(record));
    await this.prune();
    return record;
  }

  async prune() {
    const store = await this.transaction('readwrite');
    const all = await BackupManager.request(store.getAll());
    const { drop } = BackupManager.selectForRetention(all);
    for (const id of drop) {
      store.delete(id);
    }
    return drop.length;
  }

  async list() {
    const store = await this.transaction('readonly');
    const all = await BackupManager.request(store.getAll());
    return all.sort((a, b) => b.at - a.at);
  }

  async restore(id) {
    const store = await this.transaction('readonly');
    const record = await BackupManager.request(store.get(id));
    if (!record) {
      return { success: false, message: 'That backup is no longer available' };
    }

    // Restoring is itself destructive, so it gets its own snapshot first
    await this.snapshot('before restore');
    return this.dataManager.importData(record.payload);
  }

  // Snapshots settle rather than firing on every tap, and the page being hidden
  // is the one moment worth capturing immediately
  scheduleSnapshot(delay = 20000) {
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.snapshot('change').catch(() => {}), delay);
  }

  flush() {
    clearTimeout(this.pending);
    return this.snapshot('change').catch(() => {});
  }

  // --- view --------------------------------------------------------------
  describeStorage() {
    if (this.persisted === true) {
      return 'Stored persistently — the browser will not evict it to reclaim space.';
    }
    if (this.persisted === false) {
      return 'Best effort storage — the browser may clear this data if space runs short.';
    }
    return 'This browser does not report whether storage is persistent.';
  }

  async renderInto(listElement, statusElement, onRestored) {
    // The request kicked off at startup may not have settled yet, and reporting
    // "cannot tell" when the answer is about to be "persistent" is worse than
    // waiting a moment. Asking again is cheap and idempotent.
    await this.requestPersistence();
    statusElement.textContent = this.describeStorage();

    const snapshots = await this.list();
    listElement.textContent = '';

    if (!snapshots.length) {
      const empty = document.createElement('p');
      empty.className = 'restore-empty';
      empty.textContent = 'No backups yet. One is taken automatically as you use the app.';
      listElement.appendChild(empty);
      return;
    }

    for (const snapshot of snapshots) {
      const row = document.createElement('div');
      row.className = 'restore-row';

      const when = document.createElement('div');
      when.className = 'restore-when';
      when.textContent = new Date(snapshot.at).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      const detail = document.createElement('div');
      detail.className = 'restore-detail';
      detail.textContent = `${snapshot.habits} habit${snapshot.habits === 1 ? '' : 's'}` +
        ` · ${snapshot.days} day${snapshot.days === 1 ? '' : 's'}` +
        (snapshot.reason === 'change' ? '' : ` · ${snapshot.reason}`);

      const label = document.createElement('div');
      label.className = 'restore-label';
      label.appendChild(when);
      label.appendChild(detail);

      const button = document.createElement('button');
      button.className = 'restore-button';
      button.textContent = 'Restore';
      button.onclick = async () => {
        if (!confirm(`Replace everything with the backup from ${when.textContent}?\n\n` +
                     'The current data is saved as a backup first, so this can be undone.')) {
          return;
        }
        const result = await this.restore(snapshot.id);
        if (onRestored) {
          onRestored(result);
        }
      };

      row.appendChild(label);
      row.appendChild(button);
      listElement.appendChild(row);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackupManager };
}
