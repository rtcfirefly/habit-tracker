// Which hand holds the phone, which decides which side of a counted pill the
// number sits on.
//
// The pill is two targets in one shape: the wide half adds one, the small half
// opens the number for typing. A thumb reaching across a phone lands nearest
// the side it comes from, so whichever half sits on that side is the one hit by
// accident. Adding one is what you do every day; opening the editor is not, and
// it is the one that should be out of the way.
//
//   left hand    thumb comes from the left    number on the right
//   right hand   thumb comes from the right   number on the left
//
// Which means the arrangement the app has always had is the one that suits a
// left hand. That was not a decision anybody made, and it is why the number
// kept getting pressed.
//
// Left stays the default all the same. Changing it would rearrange the pills of
// everyone who already has the app, on an update they did not ask for, to fix a
// problem they may not have - and the switch is one screen away.

const HAND_KEY = 'hand';
const HANDS = ['left', 'right'];

class HandManager {
  constructor(root) {
    this.root = root;
    this.hand = HandManager.load();
    this.apply();
  }

  static get hands() {
    return HANDS.slice();
  }

  static load() {
    const stored = localStorage.getItem(HAND_KEY);
    return HANDS.includes(stored) ? stored : 'left';
  }

  static isHand(value) {
    return HANDS.includes(value);
  }

  // Asked by the view rather than done with CSS, so that the order on screen is
  // the order in the markup. Reversing a flex row leaves a screen reader and
  // the tab key walking the pill the opposite way round to the eye.
  static numberFirst() {
    return HandManager.load() === 'right';
  }

  set(hand) {
    if (!HandManager.isHand(hand) || hand === this.hand) return;
    this.hand = hand;
    localStorage.setItem(HAND_KEY, hand);
    this.apply();
    if (this.onChanged) this.onChanged(hand);
  }

  apply() {
    HANDS.forEach(hand => {
      const on = hand === this.hand;
      document.body.classList.toggle(`hand-${hand}`, on);
      document.documentElement.classList.toggle(`hand-${hand}`, on);
    });

    if (!this.root) return;
    this.root.querySelectorAll('[data-hand]').forEach(button => {
      const on = button.dataset.hand === this.hand;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    });
  }

  wire() {
    if (!this.root) return;
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-hand]');
      if (button) this.set(button.dataset.hand);
    });
  }
}
