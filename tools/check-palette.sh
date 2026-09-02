#!/bin/bash
# runs-in: host
# One palette, declared once.
#
# The habit type colour - the green, the red, the amber - used to be written
# out wherever it was needed. It reached five independent sets that way: the
# pill borders, the completed fills, the counting fills, the calendar rings and
# the day sheet rows, each chosen at a different time. They disagreed for
# months without anyone noticing, and one of them was a CSS named colour at
# 2.24:1 against white, half what its siblings managed.
#
# So: any rule that paints a habit component in a type colour must reference a
# variable, never a literal. The variables are declared once per theme and both
# looks read them. A look is a structure - border weight, plates, fills - not a
# hue, and a colour literal appearing in a look-scoped rule is that line being
# crossed.
#
# Reads one file and prints. Nothing is fetched and nothing is executed.
set -euo pipefail

CSS="${1:-$(cd "$(dirname "$0")/.." && pwd)/styles.css}"

python3 - "$CSS" <<'PY'
import re, sys

path = sys.argv[1]
src = open(path).read()

# Components whose colour is the habit's type colour
COMPONENT = re.compile(r'\.(habit-button|habit-counter|habit-emoji|day-sheet-row)\b')
# ...and the class that says which type it is
TYPE = re.compile(r'\.(is-)?(good|bad|neutral|counter)(?![\w-])')

# Properties that paint. Custom properties count: --tile is a paint by proxy.
PAINTS = re.compile(r'^\s*(background|background-color|border|border-color|'
                    r'border-(?:top|right|bottom|left)-color|color|'
                    r'box-shadow|--tile|--fill|--rail|--chip)\s*:\s*(.+?);', re.M)

# What a paint is allowed to be when it is not a variable
ALLOWED = re.compile(r'^(var\(|transparent$|inherit$|currentColor$|none$|0\s|'
                     r'\d+px\s+solid$|\d+px$)', re.I)

# A literal colour, which is the thing being banned
LITERAL = re.compile(r'#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\b(green|red|goldenrod|'
                     r'lightgreen|lightpink|lightgoldenrodyellow|gold|orange|'
                     r'white|black|grey|gray|yellow|blue|pink)\b', re.I)

# line number for an offset, without counting the whole file each time
starts = [0]
for line in src.splitlines(keepends=True):
    starts.append(starts[-1] + len(line))
def lineno(off):
    lo, hi = 0, len(starts) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if starts[mid] <= off: lo = mid
        else: hi = mid - 1
    return lo + 1

bad = []
for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', src):
    selector, body = m.group(1).strip(), m.group(2)
    selector = re.sub(r'/\*.*?\*/', '', selector, flags=re.S).strip()
    if not selector or selector.startswith('@'):
        continue
    if not (COMPONENT.search(selector) and TYPE.search(selector)):
        continue
    for p in PAINTS.finditer(body):
        prop, value = p.group(1), p.group(2).strip()
        if ALLOWED.match(value):
            continue
        if LITERAL.search(value):
            off = m.start(2) + p.start()
            bad.append((lineno(off), selector.replace('\n', ' '), prop, value))

if bad:
    print(f'check-palette: {len(bad)} colour literal(s) where a var(--...) belongs\n')
    for ln, sel, prop, val in bad:
        print(f'  {path}:{ln}')
        print(f'    {sel}')
        print(f'      {prop}: {val};')
    print('\nDeclare the colour once in the :root / .dark-mode palette block and')
    print('reference it. Two copies of a colour is two colours, eventually.')
    sys.exit(1)

print('check-palette: ok - every habit type colour comes from the palette')
PY
