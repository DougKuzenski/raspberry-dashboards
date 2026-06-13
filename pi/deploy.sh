#!/usr/bin/env bash
# One-command deploy from your laptop to the Pi — no SD card, just SSH.
#
#   ./pi/deploy.sh family        # deploy the family-calendar dashboard
#   ./pi/deploy.sh worldcup      # deploy the World Cup dashboard
#
# Defaults are overridable via env:
#   PI_HOST=pi@192.168.1.50 BRANCH=main REPO_DIR=raspberry-playground ./pi/deploy.sh family
#
# Pulls + installs + builds, then restarts the server (a --user service) and
# reloads the kiosk (cage+cog, a system service — needs sudo, hence `ssh -t`).
# The restart is gated on a successful build, so a broken push leaves the old
# version running instead of a dead kiosk.
set -euo pipefail

APP="${1:-worldcup}"
PI_HOST="${PI_HOST:-pi@worldcup.local}"
REPO_DIR="${REPO_DIR:-raspberry-playground}" # path on the Pi, relative to ~
BRANCH="${BRANCH:-main}"

case "$APP" in
  worldcup) APP_SUBDIR="";            SERVICE="worldcup-dashboard"; KIOSK="worldcup-kiosk"; PORT=3000 ;;
  family)   APP_SUBDIR="apps/family"; SERVICE="family-dashboard";  KIOSK="family-kiosk";  PORT=3001 ;;
  *) echo "Unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;;
esac

echo "Deploying '$APP' to $PI_HOST (~/$REPO_DIR/$APP_SUBDIR, services $SERVICE + $KIOSK, branch $BRANCH)…"

# -t for an interactive sudo prompt when reloading the kiosk system service.
ssh -t "$PI_HOST" "set -euo pipefail
  cd ~/$REPO_DIR
  git fetch origin $BRANCH --quiet
  git checkout $BRANCH --quiet
  git pull --ff-only origin $BRANCH
  cd ~/$REPO_DIR/$APP_SUBDIR
  npm install --no-fund --no-audit
  npm run build
  systemctl --user restart $SERVICE.service              # new server code
  sudo systemctl restart $KIOSK.service                  # reload cog -> new client code
  sleep 2
  curl -sf http://localhost:$PORT/healthz >/dev/null && echo 'healthz OK'
"

echo "✓ deployed '$APP'."
