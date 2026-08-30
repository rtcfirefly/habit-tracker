#!/usr/bin/env python3
# runs-in: container
"""Screenshot the habit tracker at a set of sizes and states.

Serves a copy of the repo over loopback and points headless Chromium at it, so
no network is needed and the default run is --network none. The repo itself is
mounted read only; the served copy differs from it only by two injected scripts,
one seeding localStorage before the app boots and one driving the UI after it.

Run through tools/screenshots/run.sh, which builds the container and mounts the
output directory.
"""

import http.server
import os
import shutil
import subprocess
import sys
import threading

REPO = '/repo'
SITE = '/tmp/site'
OUT = '/out'
PORT = 8137

HABITS = [
    {'name': '💧 Water', 'type': 'good'},
    {'name': '🏃 Run', 'type': 'good'},
    {'name': '🧘 Stretch', 'type': 'good'},
    {'name': '🚬 Smoke', 'type': 'bad'},
    {'name': '🍰 Late snack', 'type': 'bad'},
    {'name': '☕ Coffee', 'type': 'neutral'},
    {'name': '💊 Vitamins', 'type': 'good', 'counted': True, 'goal': 2},
    {'name': '📖 Read pages', 'type': 'good', 'counted': True, 'goal': 30},
    {'name': '🚬 Cigarettes', 'type': 'bad', 'counted': True, 'goal': 3},
    {'name': '☕ Coffees', 'type': 'neutral', 'counted': True},
]

# Injected into <head>, so the store is populated before the app's scripts run
# Injected into <head>. Animations and transitions make capture a race: the
# modal fades and scales in, so a screenshot or a getBoundingClientRect can land
# mid-flight. Both have happened - two ghosted screenshots and a set of rects
# scaled to 0.8. Nothing here is measuring animation, so switch them off.
STILL = """<style>
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
</style>"""

SEED = """<script>
(function () {
  var params = new URLSearchParams(location.search);
  // Theme is set before the seed bails out, so an unseeded page - the first
  // run explainer, which only shows with no habits - can still be shot dark
  localStorage.setItem('theme', params.get('theme') === 'dark' ? 'dark' : 'light');
  // Before the early return: this is a window override, not seeded storage,
  // and the shots that need it - the explainer - seed nothing.
  // defineProperty, not delete: showSaveFilePicker lives on Window.prototype,
  // so deleting it off the instance silently does nothing.
  if (params.get('nofs')) {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  }
  if (!params.get('seed')) return;
  var many = +params.get('many') || 0;
  localStorage.clear();
  var habits = %HABITS%;
  if (many) {
    var extra = JSON.parse(habits);
    for (var i = 1; i <= many; i++) extra.push({ name: '\u2b50 Extra habit ' + i, type: 'good' });
    habits = JSON.stringify(extra);
  }
  localStorage.setItem('habits', habits);
  localStorage.setItem('completions', JSON.stringify((function () {
    var out = {}, today = new Date();
    for (var i = 0; i < 20; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (i %% 3 === 0) continue;
      out[d.toDateString()] = ['💧 Water', '🏃 Run'].concat(i %% 2 ? ['☕ Coffee'] : ['🚬 Smoke']);
    }
    return out;
  })()));
  // Counters sitting at zero make the goal controls look inert, so the day the
  // shots select gets some progress against it
  localStorage.setItem('counters', JSON.stringify((function () {
    var out = {}, today = new Date();
    for (var i = 0; i < 20; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (i %% 3 === 0) continue;
      out[d.toDateString()] = {
        '💊 Vitamins': 1,
        '📖 Read pages': i %% 4 === 0 ? 30 : 12,
        '🚬 Cigarettes': i %% 5 === 0 ? 5 : 1,
        '☕ Coffees': 3
      };
    }
    return out;
  })()));
  localStorage.setItem('theme', params.get('theme') === 'dark' ? 'dark' : 'light');
  // Backdates the last backup, which is the only way to see the reminder
  // banner without waiting a week
  var stale = +params.get('stale') || 0;
  if (stale) {
    localStorage.setItem('lastExported', String(Date.now() - stale * 86400000));
  }
  if (params.get('remindoff')) localStorage.setItem('backupRemindersOff', '1');
  // Stands in for a browser without the File System Access API - Firefox,
  // Firefox Focus, iOS Safari. That path renders differently and had never
  // been shot, which is how a hole in the backup slide reached a phone.
})();
</script>"""

# Injected before </body>, so it runs after the app has wired itself up
DRIVE = """<script>
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('open') === 'manage') {
    document.getElementById('manage-habits-button').click();
  }
  // Strips the page back to the month grid, so the shot can be used as the
  // example calendar on the first explainer slide rather than cropped by hand
  var only = params.get('only');
  if (only === 'header') {
    ['.calendar-header', '.weekdays', '.calendar', '.habits-list', '.backup-nudge', '.modal']
      .forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });
    document.body.style.margin = '0';
    document.body.style.padding = '8px';
  }
  if (only === 'calendar' || only === 'app') {
    var hide = only === 'app'
      ? ['.app-header', '.backup-nudge', '.modal']
      : ['.app-header', '.habits-list', '.backup-nudge', '.modal'];
    hide.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.style.display = 'none';
    });
    document.body.style.margin = '0';
    document.body.style.padding = '8px';
  }

  // Advances the first-run explainer, which otherwise only ever shows slide one
  var slide = +params.get('slide') || 0;
  for (var i = 1; i < slide; i++) {
    var nextButton = document.getElementById('intro-next');
    if (nextButton) nextButton.click();
  }

  var tab = params.get('tab');
  if (tab) {
    var order = ['good', 'bad', 'neutral'];
    var tabs = document.querySelectorAll('.habit-tab');
    if (tabs[order.indexOf(tab)]) tabs[order.indexOf(tab)].click();
  }
  // Selects a specific day, so a shot can show the selected day and today as
  // two different cells
  var select = params.get('select');
  if (select) {
    var days = [].slice.call(document.querySelectorAll('.day:not(.other-month)'));
    var target = days.filter(function (d) {
      return d.firstChild && d.firstChild.textContent === select;
    })[0];
    if (target) target.click();
  }

  // A full six week grid plus every habit type is taller than any slide can
  // show. Trailing weeks carry the least - they are next month - so the grid
  // is cut to whole weeks. Runs after select=, which re-renders the grid and the habit buttons keep their room.
  var weeks = +params.get('weeks') || 0;
  var skipWeeks = +params.get('skipweeks') || 0;
  if (weeks || skipWeeks) {
    var cells = document.querySelectorAll('.calendar .day');
    for (var c = 0; c < cells.length; c++) {
      var week = Math.floor(c / 7);
      if (week < skipWeeks || (weeks && week >= skipWeeks + weeks)) {
        cells[c].style.display = 'none';
      }
    }
  }

  // Rings one or more elements, so a shot used as a callout can point at the
  // thing it is talking about instead of relying on the caption
  // Clicks something after the slides have run, which is the only way to reach
  // what the guide leaves behind - the spotlight, and whether the gear under
  // it still takes a tap through the dim
  // The about view lives behind a footer button, so a shot of it has to press
  // that button rather than pass a state in
  if (params.get('about')) document.getElementById('about-button').click();

  // The per-habit screen sits behind a habit's name, so a shot of it taps one
  // Comma separated, so a shot can tap one name after another - which is how
  // a second screen gets opened on top of the first
  var screenFor = params.get('screen');
  if (screenFor) {
    screenFor.split(',').forEach(function (want) {
      var names = [].slice.call(document.querySelectorAll('.habit-name-display'));
      var hit = names.filter(function (n) { return n.textContent.indexOf(want) !== -1; })[0];
      if (hit) hit.click();
    });
  }
  // Relaunching the guide from about closes the dialog and opens the deck, so
  // the shot has to press it rather than assume it worked
  if (params.get('replay')) document.getElementById('about-guide').click();

  var tap = params.get('tap');
  if (tap) {
    var hit = document.querySelector(tap);
    if (hit) hit.click();
  }

  // Rings elements so a shot used as a callout points at what it describes.
  //
  // Done with layout, not measured coordinates. A fixed position box computed
  // from getBoundingClientRect is placed at whatever width the window happens
  // to be when the script runs, and --screenshot resizes afterwards - which
  // put the first attempt at this both too wide and 150px up the page.
  //
  // Several matches get one wrapper around the lot rather than an outline
  // each: outlining three stacked full width rows individually just draws
  // stripes, which reads as three unrelated things instead of one region.
  var ring = params.get('ring');
  if (ring) {
    var found = [].slice.call(document.querySelectorAll(ring));
    if (found.length === 1) {
      found[0].style.outline = '3px solid #1a73e8';
      found[0].style.outlineOffset = '3px';
      found[0].style.borderRadius = '10px';
    } else if (found.length > 1) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'outline:3px solid #1a73e8;outline-offset:-1px;'
        + 'border-radius:10px;box-shadow:0 0 0 4px rgba(26,115,232,0.18)';
      found[0].parentNode.insertBefore(wrap, found[0]);
      found.forEach(function (el) { wrap.appendChild(el); });
    }
  }

  // The day hint fires once, on the first tap of a counter, so a shot of it
  // taps one. After select=, because a counter button is disabled until a day
  // is chosen - run before it, this clicked a dead button.
  if (params.get('bump')) {
    var counter = document.querySelector('.habit-counter');
    if (counter) counter.click();
  }

  // What holds focus decides whether a phone raises its keyboard
  if (params.get('focus')) {
    var a = document.activeElement;
    document.body.setAttribute('data-focus', a
      ? a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : '')
      : 'none');
  }

  // Tapping a selected day again opens its sheet, so a shot of the sheet
  // selects twice
  if (params.get('sheet')) {
    var target = [].slice.call(document.querySelectorAll('.day:not(.other-month)'))
      .filter(function (d) { return d.firstChild && d.firstChild.textContent === params.get('sheet'); })[0];
    if (target) { target.click(); target.click(); }
  }

  if (params.get('add')) {
    var field = document.querySelector('.habit-tab-content.active .habit-name-input');
    field.value = params.get('add');
    field.dispatchEvent(new Event('input'));
    document.querySelector('.habit-tab-content.active .add-habit-button').click();
    var b = document.activeElement;
    document.body.setAttribute('data-focus-after-add', b
      ? b.tagName.toLowerCase() + (b.className ? '.' + String(b.className).split(' ')[0] : '')
      : 'none');
  }

  if (params.get('caps')) {
    var caps = {
      fileSystemAccess: typeof window.showSaveFilePicker === 'function',
      openFilePicker: typeof window.showOpenFilePicker === 'function',
      dirPicker: typeof window.showDirectoryPicker === 'function',
      shareFiles: !!(navigator.canShare && navigator.canShare({
        files: [new File(['x'], 'a.json', { type: 'application/json' })] })),
      share: typeof navigator.share === 'function',
      persistentStorage: !!(navigator.storage && navigator.storage.persist),
      indexedDB: typeof indexedDB !== 'undefined',
      periodicSync: !!(window.ServiceWorkerRegistration &&
        'periodicSync' in window.ServiceWorkerRegistration.prototype),
      crypto: !!(window.crypto && window.crypto.subtle)
    };
    document.body.setAttribute('data-caps', JSON.stringify(caps));
  }

  var edit = params.get('edit');
  if (edit !== null && edit !== '') {
    var names = document.querySelectorAll('.habit-name-display');
    if (names[+edit]) names[+edit].click();
  }

  // Reports the rendered size of a selector back through the DOM, so before and
  // after can be compared with real numbers instead of eyeballed
  // Stands in for a phone's back gesture. Dispatched rather than history.back(),
  // because back() is asynchronous - the popstate lands after this script has
  // finished and the measurement below would read the state before it, which
  // looks exactly like the trap not working. This fires the same event the
  // browser fires, in time to be measured.
  // back=N presses it N times, so a shot can walk out through several panels.
  // Dispatched rather than history.back(): back() is asynchronous, so the
  // popstate would land after this script finished and the measurement below
  // would read the state before it - which looks exactly like the trap not
  // working. This fires the same event the browser fires, in time to be seen.
  // It does not unwind the real stack, so it tests the unwinding of panels
  // rather than the browser's own bookkeeping.
  var presses = +params.get('back') || 0;
  for (var press = 0; press < presses; press++) {
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  var measure = params.get('measure');
  if (measure) {
    var found = document.querySelectorAll(measure);
    var el = found[0];
    document.body.setAttribute('data-measured', JSON.stringify({
      selector: measure,
      viewport: window.innerWidth,
      iconVar: getComputedStyle(document.querySelector('.calendar')).getPropertyValue('--habit-icon-size').trim(),
      count: found.length,
      top: el ? +el.getBoundingClientRect().top.toFixed(1) : null,
      clientH: el ? el.clientHeight : null,
      scrollH: el ? el.scrollHeight : null,
      scrollable: el ? el.scrollHeight > el.clientHeight + 1 : null,
      width: el ? +el.getBoundingClientRect().width.toFixed(1) : null,
      fontSize: el ? getComputedStyle(el).fontSize : null,
      box: el ? (function (c) {
        return c.boxSizing + ' w:' + c.width + ' h:' + c.height +
               ' pad:' + c.padding + ' border:' + c.borderTopWidth;
      })(getComputedStyle(el)) : null,
      rect: el ? [+el.getBoundingClientRect().left.toFixed(1),
                  +el.getBoundingClientRect().right.toFixed(1),
                  +el.getBoundingClientRect().top.toFixed(1),
                  +el.getBoundingClientRect().bottom.toFixed(1)] : null
    }));
  }
})();
</script>"""

SHOTS = [
    ('app-390',            390,  844, 'seed=1'),
    ('app-320',            320,  760, 'seed=1'),
    ('app-1400',          1400, 1000, 'seed=1'),
    ('app-1400-sel',      1400, 1000, 'seed=1&select=12'),
    ('app-390-sel',        390,  900, 'seed=1&select=12'),
    ('app-390-dark',       390,  900, 'seed=1&theme=dark'),
    ('app-390-dark-sel',   390,  900, 'seed=1&theme=dark&select=12'),
    ('modal-good-390',     390,  844, 'seed=1&open=manage&tab=good'),
    ('modal-good-320',     320,  760, 'seed=1&open=manage&tab=good'),
    ('modal-neutral-390',  390,  844, 'seed=1&open=manage&tab=neutral'),
    ('modal-empty-390',    390,  844, 'open=manage&tab=neutral'),
    ('modal-good-900',     900,  900, 'seed=1&open=manage&tab=good'),
    ('modal-good-390-dark', 390, 844, 'seed=1&open=manage&tab=good&theme=dark'),
    ('habit-screen-390',  390,  844, 'seed=1&open=manage&tab=good&screen=Read'),
    ('habit-screen-390-dark', 390, 844, 'seed=1&open=manage&tab=good&screen=Read&theme=dark'),
    ('habit-screen-bad',  390,  844, 'seed=1&open=manage&tab=bad&screen=Cigarettes'),
    ('habit-screen-tally', 390, 844, 'seed=1&open=manage&tab=neutral&screen=Coffees'),
    ('about-390',         390,  844, 'seed=1&open=manage&about=1'),
    ('about-390-dark',    390,  844, 'seed=1&open=manage&about=1&theme=dark'),
    ('about-replay',      390,  844, 'seed=1&open=manage&about=1&replay=1'),
    ('day-sheet-390',     390,  844, 'seed=1&sheet=11'),
    ('day-sheet-390-dark', 390, 844, 'seed=1&sheet=11&theme=dark'),
    ('day-sheet-back',    390,  844, 'seed=1&sheet=11&back=1'),
    ('day-hint-390',      390,  844, 'seed=1&select=11&bump=1'),
    ('day-hint-390-dark', 390,  844, 'seed=1&select=11&bump=1&theme=dark'),
    ('modal-rename-390',   390,  844, 'seed=1&open=manage&tab=good&edit=0'),
    ('nudge-390',          390,  844, 'seed=1&stale=9'),
    ('nudge-390-dark',     390,  844, 'seed=1&stale=9&theme=dark'),
    ('nudge-390-off',      390,  844, 'seed=1&stale=9&remindoff=1'),
    ('remind-toggle-390',  390,  844, 'seed=1&stale=9&open=manage&tab=good'),
    ('remind-toggle-390-dark', 390, 844, 'seed=1&stale=9&open=manage&tab=good&theme=dark'),
    ('example-month',      390,  600, 'seed=1&only=app&skipweeks=2&weeks=2&select=12'),
    ('example-month-dark', 390,  600, 'seed=1&only=app&skipweeks=2&weeks=2&select=12&theme=dark'),
    ('example-gear',       390,   64, 'seed=1&only=header&ring=%23manage-habits-button'),
    ('example-gear-dark',  390,   64, 'seed=1&only=header&ring=%23manage-habits-button&theme=dark'),
    ('example-data',       390,  600, 'seed=1&open=manage&tab=good&ring=.file-backup,.backup-remind,.modal-footer'),
    ('example-data-dark',  390,  600, 'seed=1&open=manage&tab=good&ring=.file-backup,.backup-remind,.modal-footer&theme=dark'),
    ('intro-1-390',       390,  844, 'slide=1'),
    ('intro-2-390',       390,  844, 'slide=2'),
    ('intro-3-390',       390,  844, 'slide=3'),
    ('intro-4-390',       390,  844, 'slide=4'),
    ('intro-5-390',       390,  844, 'slide=5'),
    ('intro-6-390',       390,  844, 'slide=6'),
    ('intro-6-390-nofs',  390,  844, 'slide=6&nofs=1'),
    ('intro-1-390-dark',   390,  844, 'slide=1&theme=dark'),
    ('intro-2-390-dark',   390,  844, 'slide=2&theme=dark'),
    ('intro-5-390-dark',   390,  844, 'slide=5&theme=dark'),
    ('intro-6-390-dark',   390,  844, 'slide=6&theme=dark'),
    ('spotlight-390',      390,  844, 'slide=7'),
    ('spotlight-390-dark', 390,  844, 'slide=7&theme=dark'),
    ('spotlight-tapped',   390,  844, 'slide=7&tap=%23manage-habits-button'),
    ('intro-1-390-dark',   390,  844, 'slide=1&theme=dark'),
    ('intro-5-390-dark',   390,  844, 'slide=5&theme=dark'),
    ('intro-9-390-dark',   390,  844, 'slide=9&theme=dark'),
]


def build_site():
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    shutil.copytree(REPO, SITE, ignore=shutil.ignore_patterns('.git', 'tools'))

    import json
    seed = SEED.replace('%HABITS%', 'JSON.stringify(' + json.dumps(HABITS, ensure_ascii=False) + ')')
    seed = seed.replace('%%', '%')

    path = os.path.join(SITE, 'index.html')
    html = open(path, encoding='utf-8').read()
    html = html.replace('</head>', STILL + '\n' + seed + '\n</head>', 1)
    html = html.replace('</body>', DRIVE + '\n</body>', 1)
    open(path, 'w', encoding='utf-8').write(html)


def serve():
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(*a, directory=SITE, **kw)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def capture(name, width, height, query, path='index.html', scale=2, budget=4000):
    out = os.path.join(OUT, name + '.png')
    url = f'http://127.0.0.1:{PORT}/{path}?{query}'

    result = subprocess.run([
        'chromium',
        '--headless',
        # Chromium's own sandbox needs privileges this container deliberately
        # drops. The container is the boundary here: no network, all capabilities
        # dropped, and the only thing rendered is the repo copy made above.
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        f'--force-device-scale-factor={scale}',
        f'--window-size={width},{height}',
        f'--virtual-time-budget={budget}',
        f'--screenshot={out}',
        url,
    ], capture_output=True, text=True, timeout=120)

    if not os.path.exists(out):
        print(f'  FAILED {name}\n{result.stderr[-800:]}', file=sys.stderr)
        return False

    print(f'  {name}.png  {width}x{height} @{scale}x  {os.path.getsize(out):,} bytes')
    return True


def dump_dom(query, width=1024, height=900, path='index.html'):
    """Print the rendered DOM for one state, for checking what actually got
    applied rather than inferring it from pixels."""
    # Headless Chromium clamps the window to 500px wide, so a DOM dump below
    # that silently reports 500px layout. Screenshots are unaffected - they
    # resize the viewport for capture - and the iframes in test/index.html are
    # the way to inspect narrower widths.
    if width < 500:
        print(f'shoot.py: --dom clamps to a 500px window; {width}px will report 500px. '
              f'Use a screenshot or test/index.html instead.', file=sys.stderr)
    result = subprocess.run([
        'chromium', '--headless', '--no-sandbox', '--disable-gpu',
        '--disable-dev-shm-usage', f'--window-size={width},{height}',
        '--virtual-time-budget=20000', '--dump-dom', '--enable-logging=stderr', '--v=0',
        f'http://127.0.0.1:{PORT}/{path}?{query}',
    ], capture_output=True, text=True, timeout=120)
    print(result.stdout)
    if result.stderr.strip():
        print('--- stderr ---', file=sys.stderr)
        print(result.stderr, file=sys.stderr)


def main():
    os.makedirs(OUT, exist_ok=True)
    build_site()
    serve()

    # One-off shot without editing SHOTS:
    #   run.sh --shot NAME WIDTH HEIGHT QUERY [PATH]
    if sys.argv[1:2] == ['--shot']:
        name, width, height, query = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        path = sys.argv[6] if len(sys.argv) > 6 else 'index.html'
        scale = int(sys.argv[7]) if len(sys.argv) > 7 else 2
        return 0 if capture(name, width, height, query, path, scale=scale) else 1

    # Many shots from one container start:
    #   run.sh --shots WIDTH HEIGHT PATH SCALE NAME=QUERY [NAME=QUERY ...]
    if sys.argv[1:2] == ['--shots']:
        width, height, path, scale = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
        ok = True
        for pair in sys.argv[6:]:
            name, _, query = pair.partition('=')
            ok = capture(name, width, height, query, path, scale=scale) and ok
        return 0 if ok else 1

    if sys.argv[1:2] == ['--dom']:
        dump_dom(sys.argv[2] if len(sys.argv) > 2 else 'seed=1&open=manage&tab=good',
                 int(sys.argv[3]) if len(sys.argv) > 3 else 1024,
                 path=sys.argv[4] if len(sys.argv) > 4 else 'index.html')
        return 0

    wanted = sys.argv[1:]
    shots = [s for s in SHOTS if not wanted or s[0] in wanted]
    print(f'capturing {len(shots)} shot(s) from {SITE}')

    ok = all([capture(*s) for s in shots])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
