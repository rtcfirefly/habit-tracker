// The smallest DOM the app's render paths actually touch.
//
// The alternative was jsdom, which would mean an npm dependency for a project
// that deliberately has none. This covers element creation, tree manipulation,
// classes, attributes, listeners and the slice of querySelector the code uses -
// and nothing else. It models structure, not rendering: no layout, no CSS, no
// event bubbling.

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    // Plain assignment (style.display = 'none') plus the custom-property API,
    // which the progress fill sets from JS
    this.style = {
      _props: {},
      setProperty(name, value) { this._props[name] = String(value); },
      getPropertyValue(name) { return this._props[name] || ''; },
      removeProperty(name) { delete this._props[name]; }
    };
    this.listeners = {};
    this._text = '';
    this.parentNode = null;
    this.disabled = false;
    this.tabIndex = 0;
    this.dataset = {};

    const self = this;
    this.classList = {
      _s: new Set(),
      add(...names) { names.forEach(n => this._s.add(n)); self.attrs.class = [...this._s].join(' '); },
      remove(...names) { names.forEach(n => this._s.delete(n)); self.attrs.class = [...this._s].join(' '); },
      contains(name) { return this._s.has(name); }
    };
  }

  set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); this.attrs.class = v; }
  get className() { return [...this.classList._s].join(' '); }

  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }

  get firstChild() { return this.children[0] || null; }
  get childElementCount() { return this.children.length; }

  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; return child; }

  replaceChild(next, previous) {
    const i = this.children.indexOf(previous);
    if (i < 0) throw new Error('replaceChild: node is not a child');
    this.children[i] = next;
    next.parentNode = this;
    previous.parentNode = null;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }

  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }

  // Synthesises an event; there is no bubbling, so fire on the element that listens
  fire(type, event = {}) {
    (this.listeners[type] || []).forEach(fn => fn({ preventDefault() {}, ...event }));
  }

  focus() { globalThis.document.activeElement = this; }
  blur() { if (globalThis.document.activeElement === this) globalThis.document.activeElement = null; }
  select() {}

  contains(node) { return node === this || this.children.some(c => c.contains(node)); }

  // Supports the subset the app uses: ".a.b", ":not(.c)", '[attr="v"]', comma lists
  _matches(selector) {
    return selector.split(',').map(s => s.trim()).some(part => {
      const negated = part.match(/^(.*?):not\(\.([\w-]+)\)$/);
      if (negated) return this._matches(negated[1]) && !this.classList.contains(negated[2]);

      const attr = part.match(/^(.*?)\[([\w-]+)="(.*?)"\]$/);
      if (attr) {
        const actual = this.attrs[attr[2]] ?? (attr[2] === 'tabindex' ? this.tabIndex : '');
        return this._matches(attr[1]) && String(actual) === attr[3];
      }

      if (part.startsWith('#')) {
        return this.attrs.id === part.slice(1);
      }

      return part.split('.').filter(Boolean).every(c => this.classList.contains(c));
    });
  }

  // Detach from wherever it is. The app uses this to tear down overlays and
  // panels it built; the stub had no way to model a node leaving the tree.
  remove() {
    if (this.parentNode) {
      const kids = this.parentNode.children;
      const at = kids.indexOf(this);
      if (at !== -1) kids.splice(at, 1);
      this.parentNode = null;
    }
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child._matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector) {
    let found = [];
    for (const child of this.children) {
      if (child._matches(selector)) found.push(child);
      found = found.concat(child.querySelectorAll(selector));
    }
    return found;
  }
}

globalThis.document = {
  activeElement: null,
  createElement: tag => new El(tag),
  createTextNode: text => { const e = new El('#text'); e.textContent = text; return e; }
};

// Enough of a window for feature detection. PointerEvent is present so the
// drag wiring takes its real path here rather than the early return, even
// though a gesture itself cannot be driven from this stub.
// Enough history for the back trap: the stub records what was pushed so a
// test can see whether an overlay put an entry on and took it off again.
globalThis.history = {
  entries: [],
  state: null,
  pushState(state) { this.entries.push(state); this.state = state; },
  back() { this.entries.pop(); this.state = this.entries[this.entries.length - 1] || null; }
};

globalThis.window = {
  PointerEvent: function PointerEvent() {},
  listeners: {},
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  removeEventListener(type, fn) {
    const of = this.listeners[type] || [];
    const at = of.indexOf(fn);
    if (at !== -1) of.splice(at, 1);
  },
  // What a back gesture does: the browser pops its own entry, then tells the page
  fireBack() {
    globalThis.history.back();
    (this.listeners.popstate || []).slice().forEach(fn => fn());
  }
};

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
  clear() { this._d = {}; }
};

module.exports = { El };
