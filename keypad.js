// A number pad of our own, drawn over the calendar.
//
// The system keyboard is what this exists to avoid. It takes a third of the
// screen, the page scrolls to keep the focused field in view, and the pill you
// were aiming at moves out from under a thumb already on its way down. Every
// number this app asks for is a count - digits, no decimal point, no minus -
// so it can own a surface instead of borrowing one that was built for prose.
//
// It goes over the calendar rather than along the bottom, because the bottom
// is where the habit pills are and the whole point is that the thing being
// edited does not move or get covered.
//
// The field keeps focus and keeps its caret. inputmode="none" is what stops
// the platform keyboard opening; making the field readonly would do it too and
// would take the caret with it, so you could no longer see where a digit was
// about to land.

const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'back']
];

class Keypad {
  // input: the field being edited. over: the element to cover, the calendar by
  // default. onCancel: called if the pad is dismissed rather than committed.
  static open(input, { over, onCancel } = {}) {
    Keypad.close();
    if (!input) return null;

    // The platform keyboard is suppressed here rather than at every call site,
    // so a field can never be handed to this and still open the other one
    input.inputMode = 'none';

    const pad = document.createElement('div');
    pad.className = 'keypad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Number pad');

    KEYPAD_KEYS.forEach(row => {
      row.forEach(key => pad.appendChild(Keypad.key(key, input)));
    });

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'keypad-key keypad-done';
    done.textContent = 'Done';
    done.onclick = () => input.blur();
    Keypad.hold(done);
    pad.appendChild(done);

    const target = over || document.getElementById('calendar');
    Keypad.place(pad, target);
    document.body.appendChild(pad);
    document.body.classList.add('keypad-open');

    Keypad.current = { pad, input, onCancel, target };

    // Fixed pixel positions go stale the moment the viewport changes shape -
    // a rotation, or the browser's own chrome sliding away on scroll. Placed
    // once, the pad would sit where the calendar used to be. This also makes
    // the screenshot harness honest: it resizes the window after the page has
    // loaded, so a pad placed only at load time is measured against a width
    // the shot never had.
    Keypad.reflow = () => {
      if (Keypad.current) Keypad.place(Keypad.current.pad, Keypad.current.target);
    };
    window.addEventListener('resize', Keypad.reflow);
    window.addEventListener('orientationchange', Keypad.reflow);

    // Back closes the pad and leaves the number as it was, the same as Escape
    Keypad.trap = () => Keypad.dismiss();
    if (typeof BackTrap !== 'undefined') BackTrap.push(Keypad.trap);

    return pad;
  }

  // Every key holds the focus where it is. Without this the field blurs on the
  // first press, which commits the edit and tears the pad down under the
  // finger that opened it.
  static hold(button) {
    const keep = (event) => event.preventDefault();
    button.addEventListener('pointerdown', keep);
    button.addEventListener('mousedown', keep);
  }

  static key(name, input) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'keypad-key' + (name.length > 1 ? ` keypad-${name}` : '');
    button.textContent = name === 'back' ? '⌫' : name === 'clear' ? 'C' : name;
    if (name === 'back') button.setAttribute('aria-label', 'Delete');
    if (name === 'clear') button.setAttribute('aria-label', 'Clear');
    button.onclick = () => Keypad.press(input, name);
    Keypad.hold(button);
    return button;
  }

  // Pure enough to test: what the field holds after a key, given what it held
  // and what was selected. Selection matters because the field is opened with
  // its contents selected, so the first digit replaces rather than appends -
  // typing 3 into a field showing 12 should give 3, not 123.
  static next(value, key, selectedAll) {
    if (key === 'clear') return '';
    if (key === 'back') return value.slice(0, -1);
    if (selectedAll) return key;
    // Four digits is more than any count needs and stops a stuck key running
    return value.length >= 4 ? value : value + key;
  }

  static press(input, key) {
    const all = input.selectionStart === 0 &&
                input.selectionEnd === String(input.value).length &&
                String(input.value).length > 0;
    input.value = Keypad.next(String(input.value), key, all);
    // Put the caret past the last digit, or the next press replaces again
    if (input.setSelectionRange) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    if (input.oninput) input.oninput();
  }

  // Centred in the calendar rather than stretched across it. A month grid on a
  // tall phone is most of the screen, and keys the size of that are not easier
  // to hit, just further apart - the thumb has to travel between them.
  static place(pad, over) {
    if (!over || !over.getBoundingClientRect) return;
    const box = over.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const width = Math.min(box.width, 300);
    const height = Math.min(box.height, 340);
    pad.style.width = `${width}px`;
    pad.style.height = `${height}px`;
    pad.style.left = `${box.left + (box.width - width) / 2}px`;
    pad.style.top = `${box.top + (box.height - height) / 2}px`;
  }

  // Dismissed rather than committed: the number goes back to what it was
  static dismiss() {
    const open = Keypad.current;
    if (!open) return;
    Keypad.close();
    if (open.onCancel) open.onCancel();
  }

  static close() {
    const open = Keypad.current;
    if (!open) return;
    Keypad.current = null;
    if (Keypad.trap && typeof BackTrap !== 'undefined') BackTrap.remove(Keypad.trap);
    Keypad.trap = null;
Keypad.reflow = null;
    if (Keypad.reflow) {
      window.removeEventListener('resize', Keypad.reflow);
      window.removeEventListener('orientationchange', Keypad.reflow);
      Keypad.reflow = null;
    }
    open.pad.remove();
    document.body.classList.remove('keypad-open');
  }
}

Keypad.current = null;
Keypad.trap = null;
