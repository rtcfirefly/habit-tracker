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
    this.style = {};
    this.listeners = {};
    this._text = '';
    this.parentNode = null;
    this.disabled = false;
    this.tabIndex = 0;

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

      return part.split('.').filter(Boolean).every(c => this.classList.contains(c));
    });
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

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  clear() { this._d = {}; }
};

module.exports = { El };
