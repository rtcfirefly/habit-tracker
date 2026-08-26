// Assertions shared by the Node runner (run-tests.js) and the browser page
// (index.html). This file knows nothing about how it was loaded: everything
// that differs between a stubbed DOM and a real one arrives through `env`.
//
//   env.ok / env.section  report a result
//   env.fire              dispatch an event (stub .fire vs dispatchEvent)
//   env.list              NodeList -> Array (the stub already returns arrays)
//   env.fixture           create an element, attached to the page in a browser
//   env.resetStorage      wipe habit data without touching anything real
//   env.layout            true only where boxes have real dimensions

function runHabitTrackerTests(env) {
  const { ok, section, fire, list, fixture, resetStorage, layout } = env;
  const fresh = () => { resetStorage(); return new DataManager(); };

  const DAY = 86400000;
  const NOW = 1700000000000;

  section('the backup reminder fires only when it should');
  {
    resetStorage();
    ok('never backed up stays quiet',
       FileBackup.shouldRemind(null, null, NOW) === false);
    ok('backed up today stays quiet',
       FileBackup.shouldRemind(NOW, null, NOW) === false);
    ok('six days stays quiet',
       FileBackup.shouldRemind(NOW - 6 * DAY, null, NOW) === false);
    ok('seven days reminds',
       FileBackup.shouldRemind(NOW - 7 * DAY, null, NOW) === true);
    ok('twenty days reminds',
       FileBackup.shouldRemind(NOW - 20 * DAY, null, NOW) === true);
    ok('an active snooze silences it',
       FileBackup.shouldRemind(NOW - 20 * DAY, NOW + DAY, NOW) === false);
    ok('an expired snooze does not',
       FileBackup.shouldRemind(NOW - 20 * DAY, NOW - DAY, NOW) === true);
    ok('the text pluralises', FileBackup.reminderText(NOW - DAY, NOW).includes('1 day ago'));
    ok('and does not over-pluralise',
       FileBackup.reminderText(NOW - 9 * DAY, NOW).includes('9 days ago'));
  }

  section('the backup reminder can be turned off');
  {
    resetStorage();
    ok('on by default, with nothing stored', FileBackup.remindersEnabled === true);

    FileBackup.setRemindersEnabled(false);
    ok('turning it off sticks', FileBackup.remindersEnabled === false);

    FileBackup.snooze(NOW);
    FileBackup.setRemindersEnabled(true);
    ok('turning it back on sticks', FileBackup.remindersEnabled === true);
    ok('and clears any snooze, so it is not silently quiet',
       FileBackup.snoozedUntil === null);
  }

  section('an export counts as a backup');
  {
    resetStorage();
    ok('nothing recorded means no last backup', FileBackup.lastBackup() === null);
    FileBackup.recordExport(NOW);
    ok('a manual export records one', FileBackup.lastBackup() === NOW);
  }

  section('duplicate habit names are refused');
  {
    const dm = fresh();
    ok('first add succeeds', dm.addHabit('💧 Water', 'good') === true);
    ok('duplicate add refused', dm.addHabit('💧 Water', 'bad') === false);
    ok('only one habit stored', dm.getHabits().length === 1);

    dm.addHabit('🏃 Run', 'good');
    ok('rename onto an existing name refused', dm.updateHabit(1, '💧 Water', 'good') === false);
    ok('rename to a free name works', dm.updateHabit(1, '🏃 Jog', 'good') === true);
    ok('updating a habit to its own name still works', dm.updateHabit(1, '🏃 Jog', 'good') === true);
  }

  section('rendering cannot reorder stored habits');
  {
    const dm = fresh();
    dm.addHabit('b', 'bad');
    dm.addHabit('a', 'good');

    const before = dm.getHabits().map(h => h.name).join(',');
    dm.getHabits().sort((x, y) => x.name.localeCompare(y.name));

    ok('sorting the returned array leaves storage alone',
       dm.getHabits().map(h => h.name).join(',') === before,
       dm.getHabits().map(h => h.name).join(','));
  }

  section('counter history survives a rename');
  {
    const dm = fresh();
    const day = 'Mon Aug 10 2026';
    dm.addHabit('💧 Water', 'counter', 8);
    dm.setCounterValue(day, '💧 Water', 8);
    dm.toggleHabitCompletion(day, '💧 Water');

    ok('completed before the rename', dm.isCounterHabitCompleted(day, '💧 Water') === true);

    dm.updateHabit(0, '💧 Water intake', 'counter', 8);

    ok('counter value moved to the new name', dm.getCounterValue(day, '💧 Water intake') === 8);
    ok('old counter key removed', dm.getCounterValue(day, '💧 Water') === 0);
    ok('still completed after the rename', dm.isCounterHabitCompleted(day, '💧 Water intake') === true);
    ok('not reported as orphaned', dm.getOrphanedCounterHabitsForDate(day).length === 0);
    ok('completion record moved too', dm.isHabitCompleted(day, '💧 Water intake') === true);
  }

  section('reading a counter has no side effect');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'counter', 8);

    for (let i = 0; i < 50; i++) dm.getCounterValue('Day ' + i, '💧 Water');
    ok('reads create no date buckets', Object.keys(dm.counters).length === 0);

    dm.setCounterValue('Day 1', '💧 Water', 3);
    ok('writes still create their bucket', dm.getCounterValue('Day 1', '💧 Water') === 3);
  }

  section('import validation');
  {
    const dm = fresh();
    dm.addHabit('keep', 'good');

    const malformed = [
      ['completions value is not an array', { habits: [], completions: { d: 'nope' } }],
      ['completions holds non-strings', { habits: [], completions: { d: [1, 2] } }],
      ['completions is an array', { habits: [], completions: [] }],
      ['counter value is not a number', { habits: [], completions: {}, counters: { d: { x: 'lots' } } }],
      ['counters bucket is not an object', { habits: [], completions: {}, counters: { d: [] } }],
      ['habit names are duplicated', { habits: [{ name: 'a', type: 'good' }, { name: 'a', type: 'bad' }], completions: {} }]
    ];

    for (const [label, payload] of malformed) {
      ok('rejects: ' + label, dm.importData(JSON.stringify(payload)).success === false);
    }

    ok('existing data untouched by the failures',
       dm.getHabits().length === 1 && dm.getHabits()[0].name === 'keep');

    const valid = dm.importData(JSON.stringify({
      habits: [{ name: '💧 W', type: 'counter' }],
      completions: { d: ['💧 W'] },
      counters: { d: { '💧 W': 4 } }
    }));

    ok('accepts a valid payload', valid.success === true, valid.message);
    ok('missing counter goal repaired to 1', dm.getHabits()[0].goal === 1, String(dm.getHabits()[0].goal));
    ok('round-trips through export', JSON.parse(dm.exportData()).counters.d['💧 W'] === 4);
  }

  section('emoji extraction');
  {
    const cases = [
      ['⏰ Wake up', '⏰', 'Wake up'],
      ['⭐ Review', '⭐', 'Review'],
      ['🇬🇧 English', '🇬🇧', 'English'],
      ['1️⃣ First', '1️⃣', 'First'],
      ['Run 🏃🏽', '🏃🏽', 'Run'],
      ['Walk the dog 🚶‍♀️', '🚶‍♀️', 'Walk the dog'],
      ['👨‍👩‍👧 Family', '👨‍👩‍👧', 'Family'],
      ['No emoji here', null, 'No emoji here']
    ];

    for (const [name, emoji, label] of cases) {
      ok(`extracts from ${JSON.stringify(name)}`, EmojiUtils.extractEmoji(name) === emoji,
         JSON.stringify(EmojiUtils.extractEmoji(name)));
      ok(`labels ${JSON.stringify(name)}`, EmojiUtils.removeEmoji(name) === label,
         JSON.stringify(EmojiUtils.removeEmoji(name)));
    }

    ok('non-string input returns null', EmojiUtils.extractEmoji(undefined) === null);
  }

  section('month navigation does not overflow short months');
  {
    const cal = new CalendarView(fixture('div'), fixture('h2'), fresh());

    cal.currentDate = new Date(2026, 2, 31);
    cal.goToPreviousMonth();
    ok('31 March back reaches February', cal.currentDate.getMonth() === 1, cal.currentDate.toDateString());

    cal.currentDate = new Date(2026, 0, 31);
    cal.goToNextMonth();
    ok('31 January forward reaches February', cal.currentDate.getMonth() === 1, cal.currentDate.toDateString());
  }

  section('clearing the selected day is announced');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');

    const cal = new CalendarView(fixture('div'), fixture('h2'), dm);
    const habits = new HabitsView(fixture('div'), dm);

    const announced = [];
    cal.onDateSelected = key => { announced.push(key); habits.setSelectedDate(key); habits.render(); };

    cal.currentDate = new Date(2026, 7, 15);
    cal.selectedDate = new Date(2026, 7, 5).toDateString();
    habits.setSelectedDate(cal.selectedDate);

    cal.goToNextMonth();

    ok('listener heard the clear', announced.includes(null), JSON.stringify(announced));
    ok('habits view no longer points at August', habits.selectedDate === null);
    ok('habit buttons are disabled', list(habits.habitsListElement.querySelectorAll('.habit-button')).every(b => b.disabled));
    ok('a hint is shown instead', !!habits.habitsListElement.querySelector('.habits-hint'));
  }

  section('calendar renders a reserved icon area');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');
    dm.addHabit('🚬 Smoke', 'bad');
    dm.addHabit('⏰ Wake', 'counter', 1);

    const day = new Date(2026, 7, 12).toDateString();
    dm.toggleHabitCompletion(day, '💧 Water');
    dm.toggleHabitCompletion(day, '🚬 Smoke');
    dm.setCounterValue(day, '⏰ Wake', 1);

    const calEl = fixture('div');
    calEl.className = 'calendar';
    const cal = new CalendarView(calEl, fixture('h2'), dm);
    cal.currentDate = new Date(2026, 7, 15);
    cal.selectedDate = day;
    cal.render();

    const days = list(calEl.querySelectorAll('.day'));
    const dots = d => d.querySelector('.day-dots');
    const marked = days.find(d => dots(d).childElementCount > 0);

    ok('grid is whole weeks', days.length % 7 === 0, String(days.length));
    ok('every day has a dots container', days.every(d => !!dots(d)));
    ok('days with nothing completed still get one', days.some(d => dots(d).childElementCount === 0));
    ok('the marked day carries three icons', dots(marked).childElementCount === 3);
    ok('all three render as emoji, not fallback dots', list(marked.querySelectorAll('.habit-emoji')).length === 3);
    ok('exactly one tab stop for the grid', days.filter(d => d.tabIndex === 0).length === 1);
    ok('days are labelled buttons', days.every(d => d.getAttribute('role') === 'button' && d.getAttribute('aria-label')));
    ok('the selected day is aria-pressed', days.filter(d => d.getAttribute('aria-pressed') === 'true').length === 1);
  }

  section('keyboard selection');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');

    const calEl = fixture('div');
    calEl.className = 'calendar';
    const cal = new CalendarView(calEl, fixture('h2'), dm);

    let announced;
    cal.onDateSelected = key => { announced = key; };
    cal.currentDate = new Date(2026, 7, 15);
    cal.selectedDate = null;
    cal.render();

    let days = list(calEl.querySelectorAll('.day'));
    days[10].focus();
    ok('a day can take focus', document.activeElement === days[10]);

    fire(days[10], 'keydown', { key: 'Enter' });
    ok('Enter selects a day', typeof announced === 'string', String(announced));
    ok('the selection matches the day pressed', announced === cal.selectedDate);
    ok('focus survived the re-render', calEl.contains(document.activeElement));

    days = list(calEl.querySelectorAll('.day'));
    const before = document.activeElement;
    fire(days[10], 'keydown', { key: 'ArrowRight' });
    ok('ArrowRight moves focus', document.activeElement !== before && document.activeElement !== null);
  }

  section('a neighbouring-month day follows through');
  {
    const cal = new CalendarView(fixture('div'), fixture('h2'), fresh());
    cal.currentDate = new Date(2026, 7, 15);
    cal.render();

    fire(cal.dayElements.find(d => d.classList.contains('other-month')), 'click');

    ok('calendar moved to that month', cal.currentDate.getMonth() !== 7, cal.currentDate.toDateString());
    ok('selection survived the re-render', cal.selectedDate !== null);
  }

  section('dismissing an unchanged rename leaves the modal alone');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');

    const form = fixture('div');
    const manager = new HabitManager(fixture('div'), form, dm);
    manager.renderForm();

    const tabsBefore = form.children[0];
    const display = form.querySelector('.habit-name-display');
    ok('a name display was rendered', !!display);

    manager.startInlineEdit(display, dm.getHabits()[0], 0);
    ok('editing swaps in an input', !!form.querySelector('.habit-name-edit'));

    form.querySelector('.habit-name-edit').onblur();

    ok('display is restored', !!form.querySelector('.habit-name-display'));
    ok('the input is gone', !form.querySelector('.habit-name-edit'));
    ok('the modal was not rebuilt', form.children[0] === tabsBefore);

    manager.startInlineEdit(form.querySelector('.habit-name-display'), dm.getHabits()[0], 0);
    const input = form.querySelector('.habit-name-edit');
    input.value = '💧 Hydrate';
    input.onblur();
    ok('an actual rename is applied', dm.getHabits()[0].name === '💧 Hydrate', dm.getHabits()[0].name);
  }

  // Only a real browser gives boxes dimensions, so this is the one thing the
  // Node harness can never check: that the reserved area really is 2x2 icons.
  if (layout) {
    const calEl = fixture('div');
    calEl.className = 'calendar';
    assertReservedArea(env, measureReservedArea(window, { DataManager, CalendarView }, calEl),
                       `reserved area on this page at ${window.innerWidth}px`);

    section('the manage dialog reserves one height for every tab');
    {
      const dm = fresh();
      ['💧 Water', '🏃 Run', '🧘 Stretch'].forEach(n => dm.addHabit(n, 'good'));
      dm.addHabit('🚬 Smoke', 'bad');
      dm.addHabit('📖 Read', 'counter', 30);

      const form = fixture('div');
      const manager = new HabitManager(fixture('div'), form, dm);

      const reserved = ['good', 'bad', 'neutral', 'counter'].map(type => {
        manager.switchTab(type);
        return form.querySelector('.tab-content-wrapper').style.minHeight;
      });

      ok('a height is actually reserved', parseFloat(reserved[0]) > 0, reserved[0] || '(unset)');
      ok('every tab reserves the same height', new Set(reserved).size === 1, reserved.join(' / '));
      ok('it matches the fullest tab, not the emptiest',
         parseFloat(reserved[2]) === Math.max(...reserved.map(parseFloat)),
         reserved.join(' / '));
    }
  }
}

// Renders a calendar inside `win` and measures the area every day reserves for
// habit icons. `app` carries the classes from that window's realm: a class
// declared in a classic script is not a property of window, so an iframe has to
// hand them over explicitly. `calEl` must already be attached and laid out.
function measureReservedArea(win, app, calEl) {
  const dataManager = new app.DataManager();
  dataManager.addHabit('💧 Water', 'good');

  const monthDay = new Date(2026, 7, 12).toDateString();
  dataManager.toggleHabitCompletion(monthDay, '💧 Water');

  const calendar = new app.CalendarView(calEl, win.document.createElement('h2'), dataManager);
  calendar.currentDate = new Date(2026, 7, 15);
  calendar.render();

  const style = win.getComputedStyle(calEl);
  const icon = parseFloat(style.getPropertyValue('--habit-icon-size'));
  const gap = parseFloat(style.getPropertyValue('--habit-icon-gap'));

  const boxes = Array.from(calEl.querySelectorAll('.day-dots')).map(d => d.getBoundingClientRect());
  const root = win.document.documentElement;

  return {
    viewport: win.innerWidth,
    icon,
    gap,
    need: 2 * icon + gap,
    narrowest: Math.min(...boxes.map(b => b.width)),
    shortest: Math.min(...boxes.map(b => b.height)),
    tallest: Math.max(...boxes.map(b => b.height)),
    perRow: Math.floor((Math.min(...boxes.map(b => b.width)) + gap) / (icon + gap)),
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth
  };
}

function assertReservedArea(env, m, label) {
  env.section(`${label} — ${m.icon}px icons, needs ${m.need}px`);

  env.ok(`stylesheet reached the page, icon size resolves (${m.icon}px)`, m.icon > 0,
         'is styles.css loading here?');
  env.ok(`every day reserves >= ${m.need}px of icon width (narrowest ${m.narrowest.toFixed(1)}px)`,
         m.narrowest >= m.need - 0.5);
  env.ok(`every day reserves >= ${m.need}px of icon height (shortest ${m.shortest.toFixed(1)}px)`,
         m.shortest >= m.need - 0.5);
  env.ok('empty days reserve the same area as full ones',
         Math.abs(m.tallest - m.shortest) < 0.5,
         `tallest ${m.tallest.toFixed(1)}px vs shortest ${m.shortest.toFixed(1)}px`);
  env.ok(`at least 2 icons fit per row (${m.perRow} fit)`, m.perRow >= 2);
  env.ok(`no sideways scroll (content ${m.scrollWidth}px vs viewport ${m.clientWidth}px)`,
         m.scrollWidth <= m.clientWidth + 1);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runHabitTrackerTests };
}
