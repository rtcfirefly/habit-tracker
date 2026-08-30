// Node runner for the shared assertions. Run with:  node test/run-tests.js
//
// The browser equivalent is test/index.html, which runs the same file against a
// real DOM. Here the DOM comes from dom-stub.js, which models structure only -
// no layout, no CSS - so the layout section is skipped.

require('./dom-stub.js');

const fs = require('fs');
const path = require('path');
const { runHabitTrackerTests } = require('./tests.js');

const ROOT = path.join(__dirname, '..');

// The app's files are classic scripts defining global classes, so each one is
// evaluated and its class captured rather than imported.
const SOURCES = {
  'back-trap.js': 'BackTrap',
  'emoji-utils.js': 'EmojiUtils',
  'data-manager.js': 'DataManager',
  'file-backup.js': 'FileBackup',
  'calendar-view.js': 'CalendarView',
  'habits-view.js': 'HabitsView',
  'habit-manager.js': 'HabitManager',
  'intro.js': 'Intro'
};

for (const [file, className] of Object.entries(SOURCES)) {
  eval(fs.readFileSync(path.join(ROOT, file), 'utf8') + `\nglobalThis.${className} = ${className};`);
}

let passed = 0;
let failed = 0;

const env = {
  layout: false,
  ok(name, condition, detail = '') {
    if (condition) {
      passed++;
      console.log('  ok   ' + name);
    } else {
      failed++;
      console.log('  FAIL ' + name + (detail ? '  -> ' + detail : ''));
    }
  },
  section(title) { console.log('\n' + title); },
  fire(element, type, init) { element.fire(type, init); },
  list(nodes) { return nodes; },
  fixture(tag) { return document.createElement(tag); },
  resetStorage() { localStorage.clear(); }
};

runHabitTrackerTests(env);

console.log(`\n${'='.repeat(52)}\n${passed} passed, ${failed} failed\n${'='.repeat(52)}`);
process.exit(failed ? 1 : 0);
