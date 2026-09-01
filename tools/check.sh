#!/bin/bash
# runs-in: host
# Everything that can be checked without a browser, in one command.
#
# Three checks existed and were run from memory, which is the same arrangement
# that let a colour drift for months. A guard nobody runs is decoration, so
# there is one thing to type now and it fails on the first problem.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ unit tests"
node test/run-tests.js | tail -3

echo
echo "→ service worker cache"
tools/check-sw-cache.sh

echo
echo "→ type palette"
tools/check-palette.sh
