// Behavioural tests for the habit tracker. Run with:  node test/run-tests.js
//
// The app is a set of classic scripts that define global classes, so each
// source file is evaluated and its class captured rather than imported. The
// DOM comes from dom-stub.js, which models structure only - these tests cover
// logic and the shape of the rendered tree, never layout or CSS.

require('./dom-stub.js');

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = {
  'emoji-utils.js': 'EmojiUtils',
  'data-manager.js': 'DataManager',
  'calendar-view.js': 'CalendarView',
  'habits-view.js': 'HabitsView',
  'habit-manager.js': 'HabitManager'
};

for (const [file, className] of Object.entries(SOURCES)) {
  eval(fs.readFileSync(path.join(ROOT, file), 'utf8') + `\nglobalThis.${className} = ${className};`);
}

let passed = 0;
let failed = 0;

const ok = (name, condition, detail = '') => {
  if (condition) {
    passed++;
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (detail ? '  -> ' + detail : ''));
  }
};

const section = title => console.log('\n' + title);
const fresh = () => { localStorage.clear(); return new DataManager(); };

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
  ok('reads create no date buckets', Object.keys(dm.counters).length === 0, JSON.stringify(dm.counters).slice(0, 80));

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
  const cal = new CalendarView(document.createElement('div'), document.createElement('h2'), fresh());

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

  const cal = new CalendarView(document.createElement('div'), document.createElement('h2'), dm);
  const habits = new HabitsView(document.createElement('div'), dm);

  const announced = [];
  cal.onDateSelected = key => { announced.push(key); habits.setSelectedDate(key); habits.render(); };

  cal.currentDate = new Date(2026, 7, 15);
  cal.selectedDate = new Date(2026, 7, 5).toDateString();
  habits.setSelectedDate(cal.selectedDate);

  cal.goToNextMonth();

  ok('listener heard the clear', announced.includes(null), JSON.stringify(announced));
  ok('habits view no longer points at August', habits.selectedDate === null);
  ok('habit buttons are disabled', habits.habitsListElement.querySelectorAll('.habit-button').every(b => b.disabled));
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

  const calEl = document.createElement('div');
  const cal = new CalendarView(calEl, document.createElement('h2'), dm);
  cal.currentDate = new Date(2026, 7, 15);
  cal.selectedDate = day;
  cal.render();

  const days = calEl.querySelectorAll('.day');
  const dots = d => d.querySelector('.day-dots');

  ok('grid is whole weeks', days.length % 7 === 0, String(days.length));
  ok('every day has a dots container', days.every(d => !!dots(d)));
  ok('days with nothing completed still get one', days.some(d => dots(d).childElementCount === 0));
  ok('the marked day carries three icons', dots(days.find(d => dots(d).childElementCount > 0)).childElementCount === 3);
  ok('all three render as emoji, not fallback dots',
     days.find(d => dots(d).childElementCount > 0).querySelectorAll('.habit-emoji').length === 3);
  ok('exactly one tab stop for the grid', days.filter(d => d.tabIndex === 0).length === 1);
  ok('days are labelled buttons', days.every(d => d.getAttribute('role') === 'button' && d.getAttribute('aria-label')));
  ok('the selected day is aria-pressed', days.filter(d => d.getAttribute('aria-pressed') === 'true').length === 1);
}

section('keyboard selection');
{
  const dm = fresh();
  dm.addHabit('💧 Water', 'good');

  const calEl = document.createElement('div');
  const cal = new CalendarView(calEl, document.createElement('h2'), dm);

  let announced;
  cal.onDateSelected = key => { announced = key; };
  cal.currentDate = new Date(2026, 7, 15);
  cal.selectedDate = null;
  cal.render();

  const days = calEl.querySelectorAll('.day');

  days[10].fire('keydown', { key: 'Enter' });
  ok('Enter selects a day', typeof announced === 'string', String(announced));
  ok('the selection matches the day pressed', announced === cal.selectedDate);

  const before = document.activeElement;
  days[10].fire('keydown', { key: 'ArrowRight' });
  ok('ArrowRight moves focus', document.activeElement !== before && document.activeElement !== null);
}

section('a neighbouring-month day follows through');
{
  const cal = new CalendarView(document.createElement('div'), document.createElement('h2'), fresh());
  cal.currentDate = new Date(2026, 7, 15);
  cal.render();

  cal.dayElements.find(d => d.classList.contains('other-month')).fire('click');

  ok('calendar moved to that month', cal.currentDate.getMonth() !== 7, cal.currentDate.toDateString());
  ok('selection survived the re-render', cal.selectedDate !== null);
}

section('dismissing an unchanged rename leaves the modal alone');
{
  const dm = fresh();
  dm.addHabit('💧 Water', 'good');

  const form = document.createElement('div');
  const manager = new HabitManager(document.createElement('div'), form, dm);
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

console.log(`\n${'='.repeat(52)}\n${passed} passed, ${failed} failed\n${'='.repeat(52)}`);
process.exit(failed ? 1 : 0);
