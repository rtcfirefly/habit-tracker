#!/bin/bash
# runs-in: host
# Build (if needed) and run the screenshot container. Nothing here executes
# anything fetched from the network: the image install is pacman-verified at
# build time, and the run itself is offline by default.
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
# REPO_DIR points the run at another checkout, for comparing against an older
# revision without disturbing this one
REPO="${REPO_DIR:-$(cd "$HERE/../.." && pwd)}"
OUT="${OUT_DIR:-$HERE/out}"
IMAGE="${IMAGE:-habit-tracker-shots}"

if [ "${1:-}" = "build" ] || ! podman image exists "$IMAGE"; then
  echo "Building $IMAGE ..." >&2
  # BASE overrides the Arch base image. Needed where Docker Hub is unreachable
  # and a local Arch image has to stand in for archlinux/archlinux:base.
  base_arg=()
  [ -n "${BASE:-}" ] && base_arg=(--build-arg "BASE=$BASE")
  podman build -t "$IMAGE" "${base_arg[@]}" -f "$HERE/Dockerfile" "$HERE"
  [ "${1:-}" = "build" ] && exit 0
fi

mkdir -p "$OUT"

extra=(--pids-limit 1024 --memory 2g)

# Rootless podman: keep bind-mounted output owned by the invoking user
extra+=(--userns=keep-id)

# Offline unless explicitly told otherwise: the container serves the repo to
# itself over loopback, which --network none still provides
[ "${OFFLINE:-1}" = "1" ] && extra+=(--network none)

# Hardened unless explicitly told otherwise: nothing in here needs privileges
if [ "${HARDENED:-1}" = "1" ]; then
  extra+=(--cap-drop=ALL --security-opt=no-new-privileges)
fi

exec podman run --rm \
  -v "$REPO:/repo:ro" \
  -v "$HERE:/tools:ro" \
  -v "$OUT:/out" \
  "${extra[@]}" \
  "$IMAGE" "$@"
