#!/usr/bin/env bash
# Self-update on the Pi, fired by dashboard-auto-update.timer (and by deploy.sh
# with --force). Pulls main; on new commits it rebuilds the app(s) whose code
# changed, restarts their servers, and reloads the kiosk (which re-reads
# kiosk.json — so a manifest swap and a code change deploy the same way).
#
# App-agnostic: both dashboard servers run side by side; the manifest decides
# which the kiosk shows. Rebuilds are gated on success (set -e) so a broken push
# leaves the running version up. Polling, not a webhook (keeps the Pi loopback-only).
set -euo pipefail

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

REPO_DIR="${REPO_DIR:-$HOME/raspberry-playground}"
BRANCH="${BRANCH:-main}"
cd "$REPO_DIR"

git fetch origin "$BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" = "$REMOTE" ] && [ "$FORCE" -eq 0 ]; then
  exit 0  # nothing new — stay silent so the journal isn't spammed every 10 min
fi

changed="$(git diff --name-only "$LOCAL" "$REMOTE" 2>/dev/null || true)"
git checkout "$BRANCH" --quiet
git pull --ff-only origin "$BRANCH"

# Decide which apps need a rebuild from the changed paths (force = rebuild all).
need_wc=$FORCE
need_fam=$FORCE
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    apps/family/*) need_fam=1 ;;
    apps/*|pi/*|prototypes/*|*.md|.github/*|kiosk.json) : ;;  # not World Cup app code
    *) need_wc=1 ;;
  esac
done <<EOF
$changed
EOF

build_and_restart() {  # name  app-dir  service
  local name="$1" dir="$2" service="$3"
  if [ ! -f "$dir/.env" ]; then
    echo "skip $name (no $dir/.env)"; return 0
  fi
  echo "rebuilding $name"
  ( cd "$dir" && npm install --no-fund --no-audit && npm run build )
  systemctl --user restart "$service.service"
}

[ "$need_wc" -eq 1 ]  && build_and_restart worldcup "$REPO_DIR"             worldcup-dashboard
[ "$need_fam" -eq 1 ] && build_and_restart family   "$REPO_DIR/apps/family" family-dashboard

# Reload the kiosk to pick up new client code and/or a manifest swap. Needs root
# (system service); the installer adds a NOPASSWD rule for exactly this.
if sudo -n systemctl restart dashboard-kiosk.service 2>/dev/null; then
  echo "kiosk reloaded"
else
  echo "note: no passwordless sudo for dashboard-kiosk — servers updated; kiosk reloads on next reboot"
fi
echo "✓ updated to $(git rev-parse --short HEAD)"
