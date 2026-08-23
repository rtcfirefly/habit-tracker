// Browser half of the test harness. Feeds test/tests.js a real DOM, then runs
// the layout assertions again inside iframes pinned to fixed widths, so every
// responsive tier can be exercised without resizing the window.
// The Node half is test/run-tests.js.

(async function () {
  const summaryEl = document.getElementById('summary');
  const noticeEl = document.getElementById('notice');
  const resultsEl = document.getElementById('results');
  const fixturesEl = document.getElementById('fixtures');
  const framesEl = document.getElementById('frames');

  // Each width is checked against the media query tier it should land in
  const WIDTHS = [320, 360, 370, 371, 460, 461, 768, 1024];

  const STORAGE_KEYS = ['habits', 'completions', 'counters', 'theme'];
  const APP_ROOT = new URL('..', location.href).href;

  function makeFakeStorage() {
    const data = {};
    return {
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: k => { delete data[k]; },
      clear: () => { Object.keys(data).forEach(k => delete data[k]); },
      key: i => Object.keys(data)[i] ?? null,
      get length() { return Object.keys(data).length; }
    };
  }

  let isolated = false;
  let snapshot = null;

  try {
    Object.defineProperty(window, 'localStorage', { value: makeFakeStorage(), configurable: true });
    isolated = true;
  } catch (err) {
    snapshot = {};
    STORAGE_KEYS.forEach(k => { snapshot[k] = window.localStorage.getItem(k); });
  }

  function restoreStorage() {
    if (isolated || !snapshot) return;
    STORAGE_KEYS.forEach(k => {
      if (snapshot[k] === null) window.localStorage.removeItem(k);
      else window.localStorage.setItem(k, snapshot[k]);
    });
  }

  function notice(text, kind, button) {
    const el = document.createElement('p');
    el.className = 'notice ' + kind;
    el.textContent = text;
    if (button) el.appendChild(button);
    noticeEl.appendChild(el);
  }

  notice(
    isolated
      ? 'Your saved habits are untouched: this page and every preview below run against an in-memory store.'
      : 'This browser would not let the store be replaced, so your habit data was snapshotted and '
        + 'will be restored when the run finishes. Do not close the tab mid-run.',
    isolated ? 'good' : 'warn'
  );

  // The app's own service worker caches styles.css and the scripts, and its
  // scope covers this page - so after editing them these results can quietly
  // describe the previous version.
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    const clear = document.createElement('button');
    clear.textContent = 'Unregister and reload';
    clear.onclick = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      if (window.caches) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
      location.reload();
    };
    notice(
      'A service worker is serving this page, so styles.css and the app scripts may come from '
      + 'its cache. If you have just edited them, these results may describe stale files.',
      'warn',
      clear
    );
  }

  let passed = 0;
  let failed = 0;
  let currentList = null;

  const env = {
    layout: true,

    section(title) {
      const heading = document.createElement('h2');
      heading.className = 'section';
      heading.textContent = title;
      resultsEl.appendChild(heading);

      currentList = document.createElement('ul');
      currentList.className = 'results';
      resultsEl.appendChild(currentList);
    },

    ok(name, condition, detail = '') {
      condition ? passed++ : failed++;

      const item = document.createElement('li');
      item.className = condition ? 'pass' : 'fail';

      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = condition ? '✓' : '✕';
      item.appendChild(mark);
      item.appendChild(document.createTextNode(name));

      if (!condition && detail) {
        const why = document.createElement('span');
        why.className = 'detail';
        why.textContent = ' → ' + detail;
        item.appendChild(why);
      }

      currentList.appendChild(item);
    },

    fire(element, type, init) {
      const event = type === 'click'
        ? new MouseEvent('click', { bubbles: true, cancelable: true })
        : new KeyboardEvent(type, Object.assign({ bubbles: true, cancelable: true }, init));
      element.dispatchEvent(event);
    },

    list: nodes => Array.from(nodes),

    // Attached to the page, because a detached element has no dimensions and
    // cannot take focus - both of which the assertions rely on
    fixture(tag) {
      const el = document.createElement(tag || 'div');
      fixturesEl.appendChild(el);
      return el;
    },

    resetStorage() { window.localStorage.clear(); }
  };

  // A page holding nothing but a calendar, at the app's own origin so the real
  // stylesheet applies. script.js is left out deliberately: it is the bootstrap,
  // it expects elements this document does not have, and it would register the
  // service worker as a side effect of running the tests.
  function framePage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${APP_ROOT}styles.css">
<style>html, body { overflow: hidden; }</style>
</head>
<body>
<div class="calendar" id="calendar"></div>
<script src="${APP_ROOT}emoji-utils.js"><\/script>
<script src="${APP_ROOT}data-manager.js"><\/script>
<script src="${APP_ROOT}calendar-view.js"><\/script>
<script>
(function () {
  var data = {};
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: function (k) { return k in data ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        key: function (i) { return Object.keys(data)[i] || null; },
        get length() { return Object.keys(data).length; }
      }
    });
  } catch (e) { /* falls back to the real store, read-only here */ }
})();
// Classes declared in a classic script are not properties of window, so the
// parent cannot reach them without this
window.__app = {
  EmojiUtils: EmojiUtils,
  DataManager: DataManager,
  CalendarView: CalendarView
};
<\/script>
</body>
</html>`;
  }

  function loadFrame(width) {
    return new Promise(resolve => {
      const figure = document.createElement('figure');
      figure.className = 'frame';

      const caption = document.createElement('figcaption');
      caption.textContent = width + 'px';
      figure.appendChild(caption);

      const frame = document.createElement('iframe');
      frame.style.width = width + 'px';
      frame.title = 'Calendar at ' + width + 'px';
      frame.srcdoc = framePage();
      frame.onload = () => resolve(frame);

      figure.appendChild(frame);
      framesEl.appendChild(figure);
    });
  }

  async function runViewportMatrix() {
    for (const width of WIDTHS) {
      const frame = await loadFrame(width);
      const win = frame.contentWindow;

      if (!win || !win.__app) {
        env.section(`iframe at ${width}px`);
        env.ok('app scripts loaded inside the frame', false, 'could not reach the frame document');
        continue;
      }

      const measured = measureReservedArea(win, win.__app, win.document.getElementById('calendar'));
      assertReservedArea(env, measured, `iframe asked for ${width}px, got ${measured.viewport}px`);

      // Keyed off the viewport the frame actually got, not the width asked for,
      // so a frame that came up narrower is judged against the right tier
      const v = measured.viewport;
      const expected = v <= 370 ? 16 : 20;
      env.ok(`the ${expected}px icon tier is in force at ${v}px`, measured.icon === expected,
             `got ${measured.icon}px`);
    }
  }

  try {
    runHabitTrackerTests(env);
    await runViewportMatrix();
  } catch (err) {
    failed++;
    notice('The run threw before finishing: ' + (err && err.stack ? err.stack : err), 'warn');
  } finally {
    restoreStorage();
  }

  summaryEl.className = failed ? 'fail' : 'pass';
  summaryEl.textContent = `${passed} passed, ${failed} failed — this window ${window.innerWidth}px`;
  document.title = `${failed ? '✕' : '✓'} ${passed}/${passed + failed} — Habit Tracker tests`;

  const rerun = document.createElement('button');
  rerun.textContent = 'Re-run';
  rerun.onclick = () => location.reload();
  summaryEl.appendChild(rerun);

  fixturesEl.hidden = true;
  const toggle = document.getElementById('fixtures-toggle');
  toggle.onclick = () => {
    fixturesEl.hidden = !fixturesEl.hidden;
    toggle.textContent = fixturesEl.hidden ? 'Show rendered fixtures' : 'Hide rendered fixtures';
  };
})();
