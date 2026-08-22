#!/bin/bash
# runs-in: host
# Fail if a precached file has changed since CACHE_NAME was last bumped.
#
# sw.js serves cache-first, so a stale cache is never replaced on its own: ship
# a new styles.css without bumping the version and installed clients keep the
# old one forever. The rule is written at the top of sw.js; this enforces it.
set -euo pipefail

cd "$(dirname "$0")/.."

current=$(grep -oE "habit-tracker-v[0-9]+" sw.js | head -1)
committed=$(git show HEAD:sw.js 2>/dev/null | grep -oE "habit-tracker-v[0-9]+" | head -1)

# A bump that is not committed yet still counts as a bump
if [ -n "$committed" ] && [ "$current" != "$committed" ]; then
  echo "check-sw-cache: ok — CACHE_NAME bumped to $current (was $committed, uncommitted)"
  exit 0
fi

version_commit=$(git log -1 --format=%H -G'^const CACHE_NAME' -- sw.js)
if [ -z "$version_commit" ]; then
  echo "check-sw-cache: could not find where CACHE_NAME was last set" >&2
  exit 2
fi

# The precached paths, as sw.js lists them
mapfile -t assets < <(sed -n '/^const ASSETS = \[/,/^\];/p' sw.js \
  | grep -oE "'[^']+'" | tr -d "'" | sed 's|^\./||' | grep -v '^$')

# Everything touched since that commit, working tree included
changed=$(git diff --name-only "$version_commit"; git diff --name-only)

stale=()
for asset in "${assets[@]}"; do
  grep -qxF "$asset" <<<"$changed" && stale+=("$asset")
done

if [ ${#stale[@]} -gt 0 ]; then
  echo "CACHE_NAME is $current, set in $(git log -1 --format='%h %s' "$version_commit")"
  echo "but these precached files have changed since:"
  printf '  %s\n' "${stale[@]}"
  echo
  echo "Installed clients would keep serving the old copies. Bump CACHE_NAME in sw.js."
  exit 1
fi

echo "check-sw-cache: ok — $current, no precached file changed since it was set"
