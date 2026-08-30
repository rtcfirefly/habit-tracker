// The phone's back gesture, borrowed.
//
// Installed as a PWA there is nothing behind this app, so back means leave it.
// From inside a dialog, a sheet or the guide that is never what was meant: the
// gesture means "leave this", and the thing to leave is the panel on top.
//
// One history entry per open panel, pushed as it opens. Back then pops exactly
// one and the browser does the unwinding for us.
//
// The first version of this kept a single entry and pushed a replacement from
// inside the popstate handler, to avoid ever needing two back() calls at once.
// Re-arming during a pop does not reliably take, so the second press found
// nothing of ours on the stack and left the app - which is the whole thing
// this exists to prevent. Closing several panels at once is handled instead by
// counting what is owed and unwinding it with one history.go(-n).

class BackTrap {
  // Called by a panel as it opens
  static push(close) {
    if (!BackTrap.layers.length) {
      window.addEventListener('popstate', BackTrap.onPop);
    }
    BackTrap.layers.push(close);
    history.pushState({ overlay: BackTrap.layers.length }, '');
  }

  // Called by a panel that closed some other way - a button, Escape, the
  // backdrop. Its entry is still on the stack and has to come off, or the next
  // back press would be swallowed by an entry nothing is listening to.
  static remove(close) {
    const at = BackTrap.layers.indexOf(close);
    if (at === -1) return;

    BackTrap.layers.splice(at, 1);
    if (!BackTrap.layers.length) {
      window.removeEventListener('popstate', BackTrap.onPop);
    }

    // Not while handling a pop: the browser has already taken that entry
    if (BackTrap.popping) return;

    // Batched, because closing the dialog also closes the habit screen inside
    // it - two entries in one tick, which is one go(-2) rather than two
    // back() calls a browser may fold into one
    BackTrap.owed += 1;
    if (BackTrap.scheduled) return;

    BackTrap.scheduled = true;
    Promise.resolve().then(BackTrap.flush);
  }

  // Unwind whatever is owed, now. Called on its own by the batching above; the
  // tests call it directly, because a microtask has not run yet at the point
  // an assertion right after a close wants to look at the stack.
  static flush() {
    const owed = BackTrap.owed;
    BackTrap.owed = 0;
    BackTrap.scheduled = false;
    if (owed > 0) history.go(-owed);
  }
}

BackTrap.layers = [];
BackTrap.owed = 0;
BackTrap.scheduled = false;
BackTrap.popping = false;

BackTrap.onPop = () => {
  const close = BackTrap.layers.pop();
  if (!BackTrap.layers.length) {
    window.removeEventListener('popstate', BackTrap.onPop);
  }

  // The panel's own close() will call remove(), which must not ask the browser
  // to go back again for an entry it has just taken by itself
  BackTrap.popping = true;
  try {
    if (close) close();
  } finally {
    BackTrap.popping = false;
  }
};
