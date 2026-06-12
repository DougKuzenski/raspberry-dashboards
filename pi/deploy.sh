#!/usr/bin/env bash
# One-command deploy from your laptop to the Pi — no SD card, just SSH.
#
#   ./pi/deploy.sh family        # deploy the family-calendar dashboard
#   ./pi/deploy.sh worldcup      # deploy the World Cup dashboard
#
# Defaults are overridable via env:
#   PI_HOST=pi@192.168.1.50 BRANCH=main REPO_DIR=raspberry-playground ./pi/deploy.sh family
#
# The restart is gated on a successful build (&& chain + set -e on the Pi side),
# so a broken push leaves the old version running instead of a dead kiosk.
set -euo pipefail

APP="${1:-worldcup}"
PI_HOST="${PI_HOST:-pi@worldcup.local}"
REPO_DIR="${REPO_DIR:-raspberry-playground}" # path on the Pi, relative to ~
BRANCH="${BRANCH:-main}"

case "$APP" in
  worldcup) APP_SUBDIR="";            SERVICE="worldcup-dashboard"; PORT=3000 ;;
  family)   APP_SUBDIR="apps/family"; SERVICE="family-dashboard";  PORT=3001 ;;
  *) echo "Unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;;
esac

echo "Deploying '$APP' to $PI_HOST (~/$REPO_DIR/$APP_SUBDIR, service $SERVICE, branch $BRANCH)…"

ssh "$PI_HOST" "set -euo pipefail
  cd ~/$REPO_DIR
  git fetch origin $BRANCH --quiet
  git checkout $BRANCH --quiet
  git pull --ff-only origin $BRANCH
  cd ~/$REPO_DIR/$APP_SUBDIR
  npm install --no-fund --no-audit
  npm run build
  systemctl --user restart $SERVICE.service
  sleep 2
  curl -sf http://localhost:$PORT/healthz >/dev/null && echo 'healthz OK'
"

echo "✓ deployed. The kiosk picks up the new build on its next poll (≤60s)."
