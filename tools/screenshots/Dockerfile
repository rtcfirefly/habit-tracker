# ===========================================================================
# Screenshot container for the habit tracker.
#
# Everything comes from the official Arch repos (core/extra), verified by pacman
# against archlinux-keyring. Nothing is fetched at run time: the container
# serves the repo to itself over loopback and points headless Chromium at it,
# so the default run is --network none.
#
# Build and run through tools/screenshots/run.sh.
# ===========================================================================

# The official Arch base. Override when Docker Hub is unreachable and a local
# Arch image is already present:
#   BASE=localhost/some-arch-image ./tools/screenshots/run.sh build
ARG BASE=docker.io/archlinux/archlinux:base
FROM ${BASE}

SHELL ["/bin/bash", "-o", "pipefail", "-e", "-c"]

# The keyring in a cached base image is routinely stale, and the failure reads
# "unknown trust" rather than "unknown key" - the key is present, its trust was
# never derived, which is why installing archlinux-keyring alone does not fix
# it. Each step is load-bearing: --init creates the local signing key that
# --populate needs, the keyring install verifies against the old keyring
# (keyring updates are signed by long-lived master keys), --populate applies the
# new ownertrust, --updatedb rebuilds the database pacman actually reads.
RUN pacman-key --init \
 && pacman -Sy --noconfirm archlinux-keyring \
 && pacman-key --populate archlinux \
 && pacman-key --updatedb \
 && pacman -Syu --noconfirm --needed chromium python \
 && pacman -Scc --noconfirm

# Chromium needs a writable HOME, and which UID runs is decided at run time by
# --userns=keep-id. Pointing HOME at a world-writable directory keeps this
# working for any UID without baking one in.
# Kept as its own layer so the large Chromium install above stays cached.
# Without an emoji font every habit name renders as a tofu box and the
# screenshots misrepresent the app.
RUN pacman -Sy --noconfirm --needed noto-fonts-emoji \
 && pacman -Scc --noconfirm

ENV HOME=/tmp/home
RUN mkdir -p /tmp/home && chmod 1777 /tmp/home

WORKDIR /repo
ENTRYPOINT ["python", "/tools/shoot.py"]
