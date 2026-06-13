#!/usr/bin/env bash
# Self-update — runs ON the Pi, fired by auto-update.timer. Fetches the repo and,
# only when new commits arrived, pulls + installs deps + rebuilds + restarts the
# server + reloads the kiosk. The rebuild is gated on success (set -e), so a
# broken push leaves the old version running instead of a dead kiosk.
#
#   Usage: auto-update.sh <worldcup|family>
#
# This is deliberately *polling*, not a webhook: a webhook would mean exposing
# the Pi to the internet, which the loopback-bound kiosk design avoids.
set -euo pipefail

APP="${1:?usage: auto-update.sh <worldcup|family>}"
REPO_DIR="${REPO_DIR:-$HOME/raspberry-playground}"
BRANCH="${BRANCH:-main}"

case "$APP" in
  worldcup) APP_DIR="$REPO_DIR";             SERVICE="worldcup-dashboard"; KIOSK="worldcup-kiosk"; PORT=3000 ;;
  family)   APP_DIR="$REPO_DIR/apps/family"; SERVICE="family-dashboard";  KIOSK="family-kiosk";  PORT=3001 ;;
  *) echo "Unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;;
esac

cd "$REPO_DIR"
git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0 # nothing new — stay silent so the journal isn't spammed every 10 min
fi

echo "Updating $APP: ${LOCAL:0:7} -> ${REMOTE:0:7}"
git checkout "$BRANCH" --quiet
git pull --ff-only origin "$BRANCH"

cd "$APP_DIR"
npm install --no-fund --no-audit
npm run build # a failed build aborts here — no restart, old version keeps running

# Server is a --user service: always restartable unattended.
systemctl --user restart "$SERVICE.service"

# Kiosk is a system service (tty1). Reloading cog to pick up new *client* code
# needs root; try passwordless sudo, otherwise update the server now and let the
# new client load on the next reboot (see SETUP.md for the optional sudoers rule).
if sudo -n systemctl restart "$KIOSK.service" 2>/dev/null; then
  echo "kiosk reloaded"
else
  echo "note: no passwordless sudo for '$KIOSK' — server updated; client code loads on next reboot"
fi

sleep 2
curl -sf "http://localhost:$PORT/healthz" >/dev/null
echo "✓ $APP updated to $(git rev-parse --short HEAD)"
