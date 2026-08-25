// Just enough IndexedDB for BackupManager, so the backup path can be tested in
// Node. The browser half of the suite uses the real thing; this exists because
// headless Chromium's virtual time budget does not drive IndexedDB, so the
// screenshot harness cannot exercise it at all.

const later = (fn) => setTimeout(fn, 0);

class Req {
  constructor(run) {
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    later(() => {
      try {
        this.result = run(this);
        if (this.onsuccess) this.onsuccess({ target: this });
      } catch (error) {
        this.error = error;
        if (this.onerror) this.onerror({ target: this });
      }
    });
  }
}

class Store {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath || 'id';
    this.autoIncrement = !!options.autoIncrement;
    this.rows = new Map();
    this.next = 1;
  }
  createIndex() { return { name: 'noop' }; }
  add(record) {
    return new Req(() => {
      const key = this.autoIncrement ? this.next++ : record[this.keyPath];
      this.rows.set(key, Object.assign({}, record, { [this.keyPath]: key }));
      return key;
    });
  }
  get(key) { return new Req(() => this.rows.get(key)); }
  getAll() { return new Req(() => [...this.rows.values()]); }
  delete(key) { return new Req(() => { this.rows.delete(key); }); }
}

class DB {
  constructor() { this.stores = new Map(); }
  get objectStoreNames() {
    const names = [...this.stores.keys()];
    return { contains: n => names.includes(n) };
  }
  createObjectStore(name, options) {
    const store = new Store(name, options);
    this.stores.set(name, store);
    return store;
  }
  transaction(name) {
    return { objectStore: () => this.stores.get(name) };
  }
}

const databases = new Map();

globalThis.indexedDB = {
  open(name) {
    let db = databases.get(name);
    const fresh = !db;
    if (fresh) {
      db = new DB();
      databases.set(name, db);
    }

    // One deferred step, in the order the real API guarantees: upgrade first so
    // the object store exists, then success.
    const request = { onsuccess: null, onerror: null, onupgradeneeded: null, result: db };
    later(() => {
      if (fresh && request.onupgradeneeded) {
        request.onupgradeneeded({ target: request });
      }
      if (request.onsuccess) {
        request.onsuccess({ target: request });
      }
    });
    return request;
  },
  _reset() { databases.clear(); }
};

module.exports = { reset: () => globalThis.indexedDB._reset() };
