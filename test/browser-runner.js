// Browser half of the test harness. Feeds test/tests.js a real DOM and renders
// the results into the page. The Node half is test/run-tests.js.

(function () {
  const summaryEl = document.getElementById('summary');
  const noticeEl = document.getElementById('notice');
  const resultsEl = document.getElementById('results');
  const fixturesEl = document.getElementById('fixtures');

  // The app stores habits in localStorage under fixed keys and the tests wipe
  // it between sections. Served from the same origin as the app that would
  // destroy real data, so swap in a fake for the duration.
  const STORAGE_KEYS = ['habits', 'completions', 'counters', 'theme'];

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

  function notice(text, kind) {
    const el = document.createElement('p');
    el.className = 'notice ' + kind;
    el.textContent = text;
    noticeEl.appendChild(el);
  }

  notice(
    isolated
      ? 'Your saved habits are untouched: this page runs against an in-memory store.'
      : 'This browser would not let the store be replaced, so your habit data was '
        + 'snapshotted and will be restored when the run finishes. Do not close the tab mid-run.',
    isolated ? 'good' : 'warn'
  );

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
    // cannot take focus - both of which the assertions rely on here
    fixture(tag) {
      const el = document.createElement(tag || 'div');
      fixturesEl.appendChild(el);
      return el;
    },

    resetStorage() { window.localStorage.clear(); }
  };

  try {
    runHabitTrackerTests(env);
  } catch (err) {
    failed++;
    notice('The run threw before finishing: ' + (err && err.stack ? err.stack : err), 'warn');
  } finally {
    restoreStorage();
  }

  summaryEl.className = failed ? 'fail' : 'pass';
  summaryEl.textContent = `${passed} passed, ${failed} failed — viewport ${window.innerWidth}px`;
  document.title = `${failed ? '✕' : '✓'} ${passed}/${passed + failed} — Habit Tracker tests`;

  const rerun = document.createElement('button');
  rerun.textContent = 'Re-run';
  rerun.onclick = () => location.reload();
  summaryEl.appendChild(rerun);

  // The fixtures had to be laid out for real to be measured; tuck them away now
  fixturesEl.hidden = true;
  const toggle = document.getElementById('fixtures-toggle');
  toggle.onclick = () => {
    fixturesEl.hidden = !fixturesEl.hidden;
    toggle.textContent = fixturesEl.hidden ? 'Show rendered fixtures' : 'Hide rendered fixtures';
  };
})();
