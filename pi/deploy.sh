#!/usr/bin/env bash
# One-command deploy from your laptop to the Pi — push main, then run this to
# apply it now instead of waiting for the ~10-min self-update timer.
#
#   ./pi/deploy.sh
#
# It just runs the Pi's own auto-update logic with --force, so deploy and the
# timer share one code path (rebuild changed apps, restart servers, reload kiosk).
# Overridable via env:
#   PI_HOST=pi@192.168.1.50 BRANCH=main REPO_DIR=raspberry-playground ./pi/deploy.sh
set -euo pipefail

PI_HOST="${PI_HOST:-pi@worldcup.local}"
REPO_DIR="${REPO_DIR:-raspberry-playground}"
BRANCH="${BRANCH:-main}"

echo "Deploying $BRANCH to $PI_HOST (~/$REPO_DIR)…"
# -t for an interactive sudo prompt if passwordless kiosk reload isn't configured.
ssh -t "$PI_HOST" "BRANCH='$BRANCH' REPO_DIR=\"\$HOME/$REPO_DIR\" \"\$HOME/$REPO_DIR/pi/auto-update.sh\" --force"
echo "✓ deployed."
