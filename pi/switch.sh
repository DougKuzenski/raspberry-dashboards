#!/usr/bin/env bash
# Swap which dashboard the TV shows by flipping the committed manifest, then
# nudging the Pi to apply it immediately (instead of waiting for the timer).
#
#   ./pi/switch.sh family       # show the family calendar
#   ./pi/switch.sh worldcup     # show the World Cup dashboard
#
# Both servers always run on the Pi, so this just reloads cog at the other URL
# (~3s) — no rebuild, no reinstall, no reboot. Overridable via env:
#   PI_HOST=pi@192.168.1.50 BRANCH=main REPO_DIR=raspberry-playground ./pi/switch.sh family
set -euo pipefail

APP="${1:?usage: pi/switch.sh <worldcup|family>}"
case "$APP" in worldcup|family) ;; *) echo "unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;; esac

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PI_HOST="${PI_HOST:-pi@worldcup.local}"
REPO_DIR="${REPO_DIR:-raspberry-playground}"
BRANCH="${BRANCH:-main}"

cd "$REPO"
printf '{\n  "active": "%s"\n}\n' "$APP" > kiosk.json

if git diff --quiet -- kiosk.json && [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ]; then
  echo "kiosk.json already '$APP' and committed; re-applying on the Pi anyway."
else
  git add kiosk.json
  git commit -m "kiosk: switch to $APP"
  git push origin "$BRANCH"
fi

echo "Applying swap on $PI_HOST…"
# Also write the runtime override the kiosk reads first, so this agrees with the
# control panel (last switch wins, laptop or phone) instead of being shadowed by it.
ssh "$PI_HOST" "set -e
  cd ~/$REPO_DIR
  git pull --ff-only origin $BRANCH --quiet
  printf '%s\n' '$APP' > .kiosk-active
  sudo -n systemctl restart dashboard-kiosk.service
  echo 'swapped to $APP'
"
echo "✓ TV now showing '$APP'."
