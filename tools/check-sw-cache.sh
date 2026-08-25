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
cache_version=$(grep -oE "habit-tracker-v[0-9]+\.[0-9]+\.[0-9]+" sw.js | head -1 | sed 's/.*-v//')
# Comments are stripped first: prose about versions is not an asset url, and
# scanning it made this check fail on its own explanation
mapfile -t html_versions < <(grep -oE '\?v=[0-9]+\.[0-9]+\.[0-9]+' index.html | sed 's/?v=//' | sort -u)
mapfile -t sw_versions   < <(sed 's|//.*||' sw.js | grep -oE '\?v=[0-9]+\.[0-9]+\.[0-9]+' | sed 's/?v=//' | sort -u)

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
shown=$(grep -oE 'class="modal-version">v[0-9]+\.[0-9]+\.[0-9]+<' index.html | sed 's/.*>v//;s/<//')
if [ -z "$shown" ]; then
  echo "no version shown in the modal footer"
  fail=1
elif [ "$shown" != "$cache_version" ]; then
  echo "the modal shows v$shown but CACHE_NAME is v$cache_version"
  fail=1
fi

# --- the version must never go backwards -----------------------------------
prev=$(git show HEAD:sw.js 2>/dev/null | grep -oE "habit-tracker-v[0-9]+\.[0-9]+\.[0-9]+" | head -1 | sed 's/.*-v//' || true)
if [ -n "$prev" ] && [ "$prev" != "$cache_version" ]; then
  newest=$(printf '%s\n%s\n' "$prev" "$cache_version" | sort -V | tail -1)
  if [ "$newest" != "$cache_version" ]; then
    echo "version went backwards: HEAD is v$prev, working tree is v$cache_version"
    fail=1
  fi
fi

# --- a changed asset means the version must move ---------------------------
# Retired this when the fetch handler went network-first, on the grounds that a
# stale cache could no longer hide a change. That was wrong once assets became
# ?v= keyed: the query string IS the cache key, so shipping new bytes under the
# old key lets any cache that does not revalidate keep serving the old file.
# Three assets drifted that way before this came back.
version_commit=$(git log -1 --format=%H -G'^const CACHE_NAME' -- sw.js 2>/dev/null || true)
committed_version=$(git show HEAD:sw.js 2>/dev/null | grep -oE "habit-tracker-v[0-9]+\.[0-9]+\.[0-9]+" | head -1 | sed 's/.*-v//' || true)

if [ -n "$version_commit" ] && [ "$committed_version" = "$cache_version" ]; then
  stale=()
  while read -r changed; do
    [ -z "$changed" ] && continue
    grep -q "\./$changed?v=" sw.js && stale+=("$changed")
  done < <({ git diff --name-only "$version_commit" HEAD; git diff --name-only; } | sort -u)

  if [ ${#stale[@]} -gt 0 ]; then
    echo "these versioned assets changed since CACHE_NAME was set to v$cache_version:"
    printf '  %s\n' "${stale[@]}"
    echo "a cache keyed on ?v=$cache_version can still serve the old bytes. Bump CACHE_NAME and the ?v= on every asset."
    fail=1
  fi
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
