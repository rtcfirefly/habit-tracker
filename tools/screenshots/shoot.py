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
    {'name': '💊 Vitamins', 'type': 'counter', 'goal': 2},
    {'name': '📖 Read pages', 'type': 'counter', 'goal': 30},
]

# Injected into <head>, so the store is populated before the app's scripts run
SEED = """<script>
(function () {
  var params = new URLSearchParams(location.search);
  if (!params.get('seed')) return;
  localStorage.clear();
  localStorage.setItem('habits', %HABITS%);
  localStorage.setItem('completions', JSON.stringify((function () {
    var out = {}, today = new Date();
    for (var i = 0; i < 20; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      if (i %% 3 === 0) continue;
      out[d.toDateString()] = ['💧 Water', '🏃 Run'].concat(i %% 2 ? ['☕ Coffee'] : ['🚬 Smoke']);
    }
    return out;
  })()));
  localStorage.setItem('counters', JSON.stringify({}));
  localStorage.setItem('theme', params.get('theme') === 'dark' ? 'dark' : 'light');
})();
</script>"""

# Injected before </body>, so it runs after the app has wired itself up
DRIVE = """<script>
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get('open') === 'manage') {
    document.getElementById('manage-habits-button').click();
  }
  var tab = params.get('tab');
  if (tab) {
    var order = ['good', 'bad', 'neutral', 'counter'];
    var tabs = document.querySelectorAll('.habit-tab');
    if (tabs[order.indexOf(tab)]) tabs[order.indexOf(tab)].click();
  }
  // Reports the rendered size of a selector back through the DOM, so before and
  // after can be compared with real numbers instead of eyeballed
  var measure = params.get('measure');
  if (measure) {
    var found = document.querySelectorAll(measure);
    var el = found[0];
    document.body.setAttribute('data-measured', JSON.stringify({
      selector: measure,
      viewport: window.innerWidth,
      iconVar: getComputedStyle(document.querySelector('.calendar')).getPropertyValue('--habit-icon-size').trim(),
      count: found.length,
      width: el ? +el.getBoundingClientRect().width.toFixed(1) : null,
      fontSize: el ? getComputedStyle(el).fontSize : null
    }));
  }

  var edit = params.get('edit');
  if (edit !== null && edit !== '') {
    var names = document.querySelectorAll('.habit-name-display');
    if (names[+edit]) names[+edit].click();
  }
})();
</script>"""

SHOTS = [
    ('app-390',            390,  844, 'seed=1'),
    ('app-320',            320,  760, 'seed=1'),
    ('modal-good-390',     390,  844, 'seed=1&open=manage&tab=good'),
    ('modal-good-320',     320,  760, 'seed=1&open=manage&tab=good'),
    ('modal-counter-390',  390,  844, 'seed=1&open=manage&tab=counter'),
    ('modal-neutral-390',  390,  844, 'seed=1&open=manage&tab=neutral'),
    ('modal-empty-390',    390,  844, 'open=manage&tab=neutral'),
    ('modal-good-900',     900,  900, 'seed=1&open=manage&tab=good'),
    ('modal-good-390-dark', 390, 844, 'seed=1&open=manage&tab=good&theme=dark'),
    ('modal-rename-390',   390,  844, 'seed=1&open=manage&tab=good&edit=0'),
]


def build_site():
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    shutil.copytree(REPO, SITE, ignore=shutil.ignore_patterns('.git', 'tools', 'test'))

    import json
    seed = SEED.replace('%HABITS%', 'JSON.stringify(' + json.dumps(HABITS, ensure_ascii=False) + ')')
    seed = seed.replace('%%', '%')

    path = os.path.join(SITE, 'index.html')
    html = open(path, encoding='utf-8').read()
    html = html.replace('</head>', seed + '\n</head>', 1)
    html = html.replace('</body>', DRIVE + '\n</body>', 1)
    open(path, 'w', encoding='utf-8').write(html)


def serve():
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(*a, directory=SITE, **kw)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def capture(name, width, height, query, scale=2):
    out = os.path.join(OUT, name + '.png')
    url = f'http://127.0.0.1:{PORT}/index.html?{query}'

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
        '--virtual-time-budget=4000',
        f'--screenshot={out}',
        url,
    ], capture_output=True, text=True, timeout=120)

    if not os.path.exists(out):
        print(f'  FAILED {name}\n{result.stderr[-800:]}', file=sys.stderr)
        return False

    print(f'  {name}.png  {width}x{height} @{scale}x  {os.path.getsize(out):,} bytes')
    return True


def dump_dom(query, width=1024, height=900):
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
        '--virtual-time-budget=4000', '--dump-dom',
        f'http://127.0.0.1:{PORT}/index.html?{query}',
    ], capture_output=True, text=True, timeout=120)
    print(result.stdout)


def main():
    os.makedirs(OUT, exist_ok=True)
    build_site()
    serve()

    if sys.argv[1:2] == ['--dom']:
        dump_dom(sys.argv[2] if len(sys.argv) > 2 else 'seed=1&open=manage&tab=good',
                 int(sys.argv[3]) if len(sys.argv) > 3 else 1024)
        return 0

    wanted = sys.argv[1:]
    shots = [s for s in SHOTS if not wanted or s[0] in wanted]
    print(f'capturing {len(shots)} shot(s) from {SITE}')

    ok = all([capture(*s) for s in shots])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
