// The phone's back gesture, borrowed.
//
// Installed as a PWA there is nothing behind this app, so back means leave it.
// From inside a dialog, a sheet or the guide that is never what was meant: the
// gesture means "leave this", and the thing to leave is the panel on top.
//
// One history entry covers however many panels are open, rather than one each.
// Popping it closes the topmost panel and, if anything is still open, pushes a
// fresh entry so the next back is caught too. Two entries for two panels would
// mean closing both at once needs two back() calls in the same tick, which
// browsers are entitled to coalesce - this way the count never goes above one.

class BackTrap {
  // Called by a panel when it opens. close() will be called with no arguments
  // when the gesture reaches it.
  static push(close) {
    if (!BackTrap.layers.length) {
      history.pushState({ overlay: true }, '');
      window.addEventListener('popstate', BackTrap.onPop);
    }
    BackTrap.layers.push(close);
  }

  // Called by a panel that closed some other way - a button, Escape, the
  // backdrop. The entry is only given back once the last panel has gone.
  static remove(close) {
    const at = BackTrap.layers.indexOf(close);
    if (at === -1) return;

    BackTrap.layers.splice(at, 1);
    if (BackTrap.layers.length) return;

    window.removeEventListener('popstate', BackTrap.onPop);
    // Ours to give back: nothing else pushed it, and leaving it on the stack
    // would make the next back press do nothing at all
    history.back();
  }
}

BackTrap.layers = [];

BackTrap.onPop = () => {
  const close = BackTrap.layers.pop();

  if (BackTrap.layers.length) {
    history.pushState({ overlay: true }, '');
  } else {
    window.removeEventListener('popstate', BackTrap.onPop);
  }

  // Last, and after the bookkeeping: the panel's own close() will call
  // remove(), which finds nothing and does nothing, which is right - the
  // browser has already taken the entry
  if (close) close();
};
