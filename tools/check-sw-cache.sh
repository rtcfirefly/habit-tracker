#!/bin/bash
# runs-in: host
# Check the service worker's precache list against reality.
#
# Three things here have actually shipped broken:
#   - sw.js listed ./icon-512.png, which did not exist. cache.addAll rejects as
#     a unit, so install failed and nothing was cached at all.
#   - It listed one of the eight scripts index.html loads, so even a successful
#     install left the app broken offline.
#   - A fresh index.html was served with a stale styles.css, so every new rule
#     was missing and the icons rendered as unstyled black blobs. The ?v= on
#     each asset stops a stale cache entry matching a new request, but only if
#     index.html, sw.js and CACHE_NAME all carry the same number.
set -euo pipefail

cd "$(dirname "$0")/.."

fail=0

# --- versions agree -------------------------------------------------------
cache_version=$(grep -oE "habit-tracker-v[0-9]+" sw.js | head -1 | grep -oE '[0-9]+')
# Comments are stripped first: prose about versions is not an asset url, and
# scanning it made this check fail on its own explanation
mapfile -t html_versions < <(grep -oE '\?v=[0-9]+' index.html | grep -oE '[0-9]+' | sort -u)
mapfile -t sw_versions   < <(sed 's|//.*||' sw.js | grep -oE '\?v=[0-9]+' | grep -oE '[0-9]+' | sort -u)

for v in "${html_versions[@]}" "${sw_versions[@]}"; do
  if [ "$v" != "$cache_version" ]; then
    echo "version mismatch: CACHE_NAME is v$cache_version but an asset is tagged ?v=$v"
    fail=1
  fi
done
if [ "${#html_versions[@]}" -ne 1 ] || [ "${#sw_versions[@]}" -ne 1 ]; then
  echo "assets carry more than one ?v= value; they must all match CACHE_NAME"
  fail=1
fi

# The version shown in the modal footer is the same number, so it cannot drift
shown=$(grep -oE '<div class="modal-version">v[0-9]+</div>' index.html | grep -oE '[0-9]+')
if [ -z "$shown" ]; then
  echo "no version shown in the modal footer"
  fail=1
elif [ "$shown" != "$cache_version" ]; then
  echo "the modal shows v$shown but CACHE_NAME is v$cache_version"
  fail=1
fi

# --- every precached path exists ------------------------------------------
mapfile -t assets < <(sed -n '/^const ASSETS = \[/,/^\];/p' sw.js \
  | grep -oE "'[^']+'" | tr -d "'" | sed 's|^\./||')

for asset in "${assets[@]}"; do
  [ -z "$asset" ] && continue           # './' is the site root, not a file
  if [ ! -f "${asset%%\?*}" ]; then
    echo "precached but missing: $asset   (cache.addAll would reject and install would fail)"
    fail=1
  fi
done

# --- every script index.html loads is precached, query string included -----
while read -r script; do
  if ! printf '%s\n' "${assets[@]}" | grep -qxF "$script"; then
    echo "loaded by index.html but not precached: $script   (app would break offline)"
    fail=1
  fi
done < <(grep -oE '<script src="[^"]+"' index.html | sed 's/.*src="//;s/"//')

# --- the stylesheet too ----------------------------------------------------
sheet=$(grep -oE 'href="styles\.css[^"]*"' index.html | sed 's/href="//;s/"//')
if ! printf '%s\n' "${assets[@]}" | grep -qxF "$sheet"; then
  echo "stylesheet $sheet is not precached under that exact url"
  fail=1
fi

[ "$fail" -ne 0 ] && exit 1

echo "check-sw-cache: ok — ${#assets[@]} precached entries at v$cache_version, all present, all referenced urls covered"
