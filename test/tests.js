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

  section('counter progress is a clamped whole percent');
  {
    ok('nothing done is nothing', DataManager.progressPercent(0, 30) === 0);
    ok('a third of the way', DataManager.progressPercent(10, 30) === 33);
    ok('finished is full', DataManager.progressPercent(30, 30) === 100);
    ok('past a ceiling stays full rather than overflowing the bar',
       DataManager.progressPercent(5, 3) === 100);
    ok('a missing goal cannot divide', DataManager.progressPercent(4, 0) === 0);
    ok('nor an absent one', DataManager.progressPercent(4, undefined) === 0);
    ok('a negative count reads as nothing', DataManager.progressPercent(-2, 10) === 0);
  }

  section('a drag lands on the row under the finger');
  {
    // Three rows, 40px each, stacked from y=100
    const rows = [
      { index: 0, top: 100, bottom: 140 },
      { index: 1, top: 140, bottom: 180 },
      { index: 2, top: 180, bottom: 220 }
    ];
    ok('a finger on the first row targets it', HabitManager.rowUnder(rows, 110) === 0);
    ok('on the second targets the second', HabitManager.rowUnder(rows, 160) === 1);
    ok('on the third targets the third', HabitManager.rowUnder(rows, 200) === 2);
    ok('dragged above the list, the top row', HabitManager.rowUnder(rows, 10) === 0,
       'dragging past the top should mean the top, not nothing');
    ok('dragged below the list, the bottom row', HabitManager.rowUnder(rows, 900) === 2);
    ok('an empty list has no target', HabitManager.rowUnder([], 120) === null);
  }

  section('a number means what the habit’s kind says it means');
  {
    ok('good counts toward a goal', DataManager.direction('good') === 'goal');
    ok('bad counts against a limit', DataManager.direction('bad') === 'limit');
    ok('neutral just counts', DataManager.direction('neutral') === 'tally');

    const goal = { name: '📖 Read', type: 'good', counted: true, goal: 30 };
    ok('short of a goal is under', DataManager.countState(goal, 12) === 'under');
    ok('reaching a goal is done', DataManager.countState(goal, 30) === 'done');
    ok('past a goal is still done', DataManager.countState(goal, 44) === 'done');

    const limit = { name: '🚬 Smoke', type: 'bad', counted: true, goal: 3 };
    ok('inside a limit is under, not done',
       DataManager.countState(limit, 2) === 'under',
       'a ceiling is only survived at the end of the day, never completed at 2pm');
    ok('sitting on a limit is still inside it', DataManager.countState(limit, 3) === 'under');
    ok('past a limit is over', DataManager.countState(limit, 4) === 'over');
    ok('a limit is never done', DataManager.countState(limit, 3) !== 'done');

    const tally = { name: '☕ Coffee', type: 'neutral', counted: true };
    ok('a tally with something on it is counting', DataManager.countState(tally, 3) === 'counting');
    ok('a tally never finishes', DataManager.countState(tally, 99) !== 'done');
    ok('nothing logged is nothing, whatever the kind',
       DataManager.countState(goal, 0) === 'none' && DataManager.countState(tally, 0) === 'none');

    ok('a tally has no target to measure against', DataManager.hasTarget(tally) === false);
    ok('a counted habit with no number has none either',
       DataManager.hasTarget({ type: 'good', counted: true }) === false);
  }

  section('a habit switched to counting is drawn once, not twice');
  {
    const dm = fresh();
    const day = new Date(2026, 7, 12).toDateString();

    // Ticked while it was a plain habit...
    dm.addHabit('🍺 NA Beer', 'neutral');
    dm.toggleHabitCompletion(day, '🍺 NA Beer');
    ok('the tick is recorded', dm.isHabitCompleted(day, '🍺 NA Beer') === true);

    // ...then switched to counting, which keeps the old tick on purpose
    dm.updateHabit(0, '🍺 NA Beer', 'neutral', null, true);
    dm.setCounterValue(day, '🍺 NA Beer', 1);
    ok('the tick is still there underneath', dm.isHabitCompleted(day, '🍺 NA Beer') === true,
       'switching should not throw away days recorded before the switch');

    const calEl = fixture('div');
    calEl.className = 'calendar';
    const cal = new CalendarView(calEl, fixture('h2'), dm);
    cal.currentDate = new Date(2026, 7, 15);
    cal.render();

    const marked = list(calEl.querySelectorAll('.day'))
      .map(d => d.querySelector('.day-dots'))
      .filter(dots => dots.childElementCount > 0);

    ok('the day carries one icon, not one per store',
       marked.length === 1 && marked[0].childElementCount === 1,
       marked.map(m => m.childElementCount).join(','));

    // A day ticked before the switch, with no count of its own, keeps its mark:
    // the count stands in for the tick only where there is a count
    const earlier = new Date(2026, 7, 10).toDateString();
    dm.toggleHabitCompletion(earlier, '🍺 NA Beer');
    cal.render();
    const both = list(calEl.querySelectorAll('.day'))
      .map(d => d.querySelector('.day-dots'))
      .filter(dots => dots.childElementCount > 0);
    ok('a day with only the old tick still shows it',
       both.length === 2 && both.every(d => d.childElementCount === 1),
       both.map(m => m.childElementCount).join(','));

    // Turning counting off again brings the old tick back into view
    dm.updateHabit(0, '🍺 NA Beer', 'neutral', null, false);
    cal.render();
    const after = list(calEl.querySelectorAll('.day'))
      .map(d => d.querySelector('.day-dots'))
      .filter(dots => dots.childElementCount > 0);
    ok('and both days still carry one icon once counting is switched off',
       after.length === 2 && after.every(d => d.childElementCount === 1),
       after.map(m => m.childElementCount).join(','));
  }

  section('a rename cannot swallow a deleted habit’s history');
  {
    const dm = fresh();
    const day = 'Mon Aug 10 2026';

    dm.addHabit('🅰️ Alpha', 'good', 3, true);
    dm.setCounterValue(day, '🅰️ Alpha', 3);
    // Beta is gone from the list, but both stores keep its past on purpose
    dm.addHabit('🅱️ Beta', 'good', 99, true);
    dm.setCounterValue(day, '🅱️ Beta', 99);
    dm.toggleHabitCompletion(day, '🅱️ Beta');
    dm.deleteHabit(1);

    ok('the deleted habit’s count is still on file',
       dm.getCounterValue(day, '🅱️ Beta') === 99);

    const renamed = dm.updateHabit(0, '🅱️ Beta', 'good');
    ok('renaming onto it is refused', renamed === false,
       'it used to succeed and overwrite the 99 with the 3');
    ok('so the deleted habit keeps its count', dm.getCounterValue(day, '🅱️ Beta') === 99);
    ok('and the renamed one keeps its own', dm.getCounterValue(day, '🅰️ Alpha') === 3);
    ok('and the name did not change', dm.getHabits()[0].name === '🅰️ Alpha');

    // A name nothing has ever answered to is still free
    ok('an unused name is allowed', dm.updateHabit(0, '🅾️ Omega', 'good') === true);
  }

  section('a habit named __proto__ still counts');
  {
    const dm = fresh();
    const day = 'Tue Aug 11 2026';
    dm.addHabit('__proto__', 'neutral', null, true);
    dm.setCounterValue(day, '__proto__', 2);
    ok('the count is recorded rather than swallowed by the prototype',
       dm.getCounterValue(day, '__proto__') === 2,
       String(dm.getCounterValue(day, '__proto__')));
    dm.incrementCounter(day, '__proto__');
    ok('and it goes up', dm.getCounterValue(day, '__proto__') === 3);
  }

  section('switching counting on does not invent a goal');
  {
    const dm = fresh();
    dm.addHabit('🏃 Run', 'good');
    dm.updateHabit(0, '🏃 Run', 'good', null, true);
    const habit = dm.getHabits()[0];
    ok('it counts', DataManager.isCounted(habit) === true);
    ok('but has nothing to reach yet', DataManager.hasTarget(habit) === false,
       'a goal of 1 made the first tap finish it');
    ok('so one tap is counting, not done',
       DataManager.countState(habit, 1) === 'counting');
  }

  section('the retired counter type migrates to the one that asserts nothing');
  {
    const migrated = DataManager.migrate([
      { name: '📖 Read', type: 'counter', goal: 30 },
      { name: '💧 Water', type: 'good' }
    ]);
    ok('a counter becomes neutral', migrated[0].type === 'neutral',
       'good would make the app congratulate someone for counting cigarettes');
    ok('and stays counted', migrated[0].counted === true);
    ok('keeping its number for if it is retyped later', migrated[0].goal === 30);
    ok('everything else is left alone', migrated[1].type === 'good' && !migrated[1].counted);
  }

  section('the look is a separate choice from light and dark');
  {
    resetStorage();
    ok('cards by default, because that is what is already on screen',
       LookManager.load() === 'cards');

    localStorage.setItem('look', 'ruled');
    ok('a stored look is honoured', LookManager.load() === 'ruled');

    localStorage.setItem('look', 'chartreuse');
    ok('and nonsense falls back rather than styling nothing',
       LookManager.load() === 'cards');

    ok('both looks are offered', LookManager.looks.join(',') === 'cards,ruled');
    ok('and only those two', LookManager.isLook('ruled') === true &&
       LookManager.isLook('sepia') === false);
  }

  section('every explainer slide makes one point');
  {
    const slides = Intro.slides;
    ok('there are slides at all', slides.length > 0);

    const missing = slides.filter(s => !s.art || !s.title || !s.body);
    ok('each has art, a title and a body', missing.length === 0,
       missing.map(s => s.title || '(untitled)').join(', '));

    const leftover = slides.filter(s => s.tip);
    ok('none carries a trailing tip line', leftover.length === 0,
       leftover.map(s => s.title).join(', '));

    // Two sentences in a body is the shape of two ideas sharing a slide.
    // Splitting them across slides is cheaper than making someone read twice.
    const wordy = slides.filter(s => /[.!?]\s+\S/.test(s.body));
    ok('each body is a single sentence', wordy.length === 0,
       wordy.map(s => s.title).join(', '));

    const unpunctuated = slides.filter(s => !/[.!?]$/.test(s.body));
    ok('and ends in a full stop', unpunctuated.length === 0,
       unpunctuated.map(s => s.title).join(', '));
  }

  section('the explainer shows until there is a habit');
  {
    const dm = fresh();
    ok('an empty app shows it', Intro.shouldShow(dm) === true);
    ok('and keeps showing it while the app is still empty',
       Intro.shouldShow(dm) === true,
       'skipping should not dismiss it for good - there is nothing else to see yet');

    dm.addHabit('💧 Water', 'good');
    ok('adding the first habit is what dismisses it', Intro.shouldShow(dm) === false);

    dm.deleteHabit(0);
    ok('deleting back to empty brings it back', Intro.shouldShow(dm) === true);

    resetStorage();
    const returning = new DataManager();
    returning.addHabit('🏃 Run', 'good');
    ok('someone who already has habits never sees it',
       Intro.shouldShow(returning) === false,
       'an existing user upgrading should not be shown a first-run tour');
  }

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
    dm.addHabit('💧 Water', 'good', 8, true);
    dm.setCounterValue(day, '💧 Water', 8);
    dm.toggleHabitCompletion(day, '💧 Water');

    ok('completed before the rename', dm.isCounterHabitCompleted(day, '💧 Water') === true);

    dm.updateHabit(0, '💧 Water intake', 'good', 8, true);

    ok('counter value moved to the new name', dm.getCounterValue(day, '💧 Water intake') === 8);
    ok('old counter key removed', dm.getCounterValue(day, '💧 Water') === 0);
    ok('still completed after the rename', dm.isCounterHabitCompleted(day, '💧 Water intake') === true);
    ok('not reported as orphaned', dm.getOrphanedCounterHabitsForDate(day).length === 0);
    ok('completion record moved too', dm.isHabitCompleted(day, '💧 Water intake') === true);
  }

  section('reading a counter has no side effect');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good', 8, true);

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
      habits: [{ name: '💧 W', type: 'good', counted: true }],
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
    dm.addHabit('⏰ Wake', 'good', 1, true);

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

  section('back unwinds one panel at a time, and never leaves the app');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');

    const modal = fixture('div');
    const content = fixture('div');
    content.classList.add('modal-content');
    const body = fixture('div');
    body.classList.add('modal-body');
    const form = fixture('div');
    body.appendChild(form);
    content.appendChild(body);
    modal.appendChild(content);

    const manager = new HabitManager(modal, form, dm);
    history.entries.length = 0;

    manager.open();
    ok('opening the dialog puts one entry on the stack', history.entries.length === 1);

    // A second panel, pushed directly. The habit screen used to be this, and
    // deleting it must not delete the coverage: what is being tested is that
    // BackTrap gives one entry per panel and unwinds them one at a time.
    let panelOpen = true;
    const panel = () => { panelOpen = false; BackTrap.remove(panel); };
    BackTrap.push(panel);
    ok('the panel on top adds one of its own', history.entries.length === 2);

    window.fireBack();
    ok('back closes the panel first', panelOpen === false);
    ok('the dialog is still open behind it', modal.style.display !== 'none');
    ok('and the dialog’s own entry is still on the stack, for the next press',
       history.entries.length === 1,
       'this is the one that used to be missing, so the second press left the app');

    window.fireBack();
    ok('back then closes the dialog', modal.style.display === 'none');
    ok('and the stack is given back, so the next press leaves the app as normal',
       history.entries.length === 0);

    // Closing by hand has to give the entry back too, or the next back press
    // would be swallowed by an entry nothing is listening to
    manager.open();
    ok('open again, one entry', history.entries.length === 1);
    manager.close();
    BackTrap.flush();
    ok('closing by hand takes it off', history.entries.length === 0);

    // Two panels torn down at once has to be one go(-2) rather than two back()
    // calls a browser may fold into one
    manager.open();
    let second = true;
    const other = () => { second = false; BackTrap.remove(other); };
    BackTrap.push(other);
    ok('two panels, two entries', history.entries.length === 2);
    other();
    manager.close();
    BackTrap.flush();
    ok('closing both at once gives both entries back, in one unwind',
       history.entries.length === 0, String(history.entries.length));

    // Closing ONE of two panels by hand. The unwind that gives its entry back
    // is a real popstate, and with the dialog still open the trap is still
    // listening - so it used to answer its own pop by closing the dialog too.
    manager.open();
    let third = true;
    const inner = () => { third = false; BackTrap.remove(inner); };
    BackTrap.push(inner);
    inner();
    BackTrap.flush();
    ok('backing out of a panel leaves the dialog standing',
       modal.style.display !== 'none',
       'the trap answered its own unwind and closed the dialog underneath');
    ok('and the dialog keeps exactly one entry', history.entries.length === 1,
       String(history.entries.length));

    window.fireBack();
    ok('back then closes the dialog and nothing else', modal.style.display === 'none');
    ok('with the stack empty', history.entries.length === 0, String(history.entries.length));
  }

  section('a tally has nothing to fill toward, so the calendar does not fill it');
  {
    const dm = fresh();
    dm.addHabit('☕ Coffees', 'neutral', null, true);
    dm.addHabit('📖 Read', 'good', 30, true);
    const day = new Date(2026, 7, 15).toDateString();
    dm.setCounterValue(day, '☕ Coffees', 3);
    dm.setCounterValue(day, '📖 Read', 15);

    const calEl = fixture('div');
    calEl.className = 'calendar';
    const cal = new CalendarView(calEl, fixture('h2'), dm);
    cal.currentDate = new Date(2026, 7, 15);
    cal.render();

    const icons = list(calEl.querySelectorAll('.habit-emoji'));
    const tally = icons.filter(i => i.classList.contains('neutral'))[0];
    const goal  = icons.filter(i => i.classList.contains('good'))[0];

    ok('a counted neutral habit still gets its icon', !!tally);
    // It used to be filled to 100% on every such day, which is a bar that can
    // never say anything - and the fill dragged the disc off its own hue
    ok('but it is not filled', tally && !tally.classList.contains('filling'));
    ok('and carries no percentage at all',
       tally && !tally.style.getPropertyValue('--pct'));

    ok('a habit with a real target is still filled', goal && goal.classList.contains('filling'));
    ok('to the proportion it has reached',
       goal && goal.style.getPropertyValue('--pct') === '50%',
       goal && goal.style.getPropertyValue('--pct'));
  }

  section('the row is the editor: name and count, edited where they sit');
  {
    const dm = fresh();
    dm.addHabit('💧 Water', 'good');
    dm.addHabit('📖 Read', 'good', 30, true);
    dm.addHabit('☕ Coffees', 'neutral', null, true);

    const modal = fixture('div');
    const content = fixture('div');
    content.classList.add('modal-content');
    const body = fixture('div');
    body.classList.add('modal-body');
    const form = fixture('div');
    body.appendChild(form);
    content.appendChild(body);
    modal.appendChild(content);

    const manager = new HabitManager(modal, form, dm);
    manager.renderForm();

    const cells = () => [...form.querySelectorAll('.habit-count-cell')];
    const names = () => [...form.querySelectorAll('.habit-name-display')];

    ok('every row carries a count cell', cells().length === form.querySelectorAll('.manage-item').length);
    ok('a habit that does not count shows the dash, not an empty cell',
       cells()[0].textContent === '–' && cells()[0].classList.contains('empty'));
    ok('a habit that counts shows its figure bare', cells()[1].textContent === '30');

    // Typing a number is the only way counting gets turned on. There is no
    // switch, which is the whole design.
    cells()[0].onclick();
    const box = form.querySelectorAll('input.habit-count-cell')[0];
    ok('tapping the cell puts an input in its place', !!box);
    ok('the input asks for the numeric keypad', box.inputMode === 'numeric');
    box.value = '8';
    box.onblur();
    ok('a typed number turns counting on', DataManager.isCounted(dm.getHabits()[0]));
    ok('and becomes the target', dm.getHabits()[0].goal === 8);
    ok('the row goes back to text', form.querySelectorAll('input.habit-count-cell').length === 0);

    // Emptying it is the way back off, and must not throw the number away
    cells()[0].onclick();
    const clear = form.querySelectorAll('input.habit-count-cell')[0];
    clear.value = '';
    clear.onblur();
    ok('clearing the cell stops it counting', !DataManager.isCounted(dm.getHabits()[0]));
    ok('but the number it had is kept, so a stray backspace is not destructive',
       dm.getHabits()[0].goal === 8);

    // Escape reverts rather than commits
    cells()[1].onclick();
    const esc = form.querySelectorAll('input.habit-count-cell')[0];
    esc.value = '99';
    esc.onkeydown({ key: 'Escape', preventDefault() {} });
    ok('Escape leaves the habit alone', dm.getHabits()[1].goal === 30);

    // A neutral habit has no figure to hold, so its cell toggles instead
    const tally = cells()[2];
    ok('the neutral cell is a toggle, not a field', tally.classList.contains('is-toggle'));
    ok('and says so to a screen reader', tally.getAttribute('role') === 'button');
    ok('it shows a tick while counting', tally.textContent === '✓');
    tally.onclick();
    ok('tapping it stops the tally', !DataManager.isCounted(dm.getHabits()[2]));
    ok('and the cell shows the same dash the others use',
       cells()[2].textContent === '–');

    // The name edits in place, which is what replaced the screen
    names()[0].onclick();
    const rename = form.querySelectorAll('input.habit-name-display')[0];
    ok('tapping a name puts an input in its place', !!rename);
    ok('it starts with the whole name, emoji and all', rename.value === '💧 Water');
    rename.value = '💧 Hydrate';
    rename.onblur();
    ok('the name is saved', dm.getHabits()[0].name === '💧 Hydrate');
    ok('and no input is left behind',
       form.querySelectorAll('input.habit-name-display').length === 0);

    // A clash is refused by the model and the row simply redraws
    names()[0].onclick();
    const clash = form.querySelectorAll('input.habit-name-display')[0];
    clash.value = '📖 Read';
    clash.onblur();
    ok('renaming onto a name already taken is refused',
       dm.getHabits()[0].name === '💧 Hydrate');
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
      dm.addHabit('📖 Read', 'good', 30, true);

      const form = fixture('div');
      const manager = new HabitManager(fixture('div'), form, dm);

      const reserved = ['good', 'bad', 'neutral'].map(type => {
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
