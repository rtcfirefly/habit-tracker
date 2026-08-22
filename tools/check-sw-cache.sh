#!/bin/bash
# runs-in: host
# Check the service worker's precache list against reality.
#
# Both of these have actually shipped broken here:
#   - sw.js listed ./icon-512.png, which did not exist. cache.addAll rejects as
#     a unit, so install failed and nothing was cached at all.
#   - It listed one of the eight scripts index.html loads, so even a successful
#     install left the app broken offline.
#
# It no longer checks that CACHE_NAME was bumped: the fetch handler is
# network-first, so a stale cache does not stop a change reaching anyone.
set -euo pipefail

cd "$(dirname "$0")/.."

mapfile -t assets < <(sed -n '/^const ASSETS = \[/,/^\];/p' sw.js \
  | grep -oE "'[^']+'" | tr -d "'" | sed 's|^\./||')

fail=0

for asset in "${assets[@]}"; do
  [ -z "$asset" ] && continue           # './' is the site root, not a file
  if [ ! -f "$asset" ]; then
    echo "precached but missing: $asset   (cache.addAll would reject and install would fail)"
    fail=1
  fi
done

while read -r script; do
  if ! printf '%s\n' "${assets[@]}" | grep -qxF "$script"; then
    echo "loaded by index.html but not precached: $script   (app would break offline)"
    fail=1
  fi
done < <(grep -oE '<script src="[^"]+"' index.html | sed 's/.*src="//;s/"//')

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "check-sw-cache: ok — ${#assets[@]} precached entries, all present, all scripts covered"
