#!/usr/bin/env bash
#
# Run a dashboard on your Android phone (Termux) — pull latest, build, and serve
# it so you can open it in the phone's browser. You edit the repo with the Claude
# Code app and push; on the phone you just re-run this to pull + rebuild + serve.
#
#   bash scripts/termux-run.sh            # World Cup board  -> http://localhost:3000
#   bash scripts/termux-run.sh family     # Family calendar  -> http://localhost:3001
#
# One-time prereqs (Termux from F-Droid — NOT the Play Store):
#   pkg update -y && pkg install -y nodejs git
# See docs/termux.md for the full walkthrough and gotchas.
set -euo pipefail

APP="${1:-worldcup}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

case "$APP" in
  worldcup) APP_DIR="$REPO";             PORT=3000; DEFAULT_ENV="DATA_PROVIDER=openfootball" ;;
  family)   APP_DIR="$REPO/apps/family"; PORT=3001; DEFAULT_ENV="CAL_PROVIDER=manual" ;;
  *) echo "unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;;
esac

# Preflight: Node + npm must be installed (npm ships with Node).
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: node/npm not found. In Termux run:  pkg update -y && pkg install -y nodejs git" >&2
  exit 1
fi

# Let esbuild pick its own binary (current Termux Node reports 'android', so it
# self-selects a working Android build). Forcing the system esbuild via this var
# breaks the build on a version mismatch — so clear it if a stale one is exported.
unset ESBUILD_BINARY_PATH 2>/dev/null || true

# Pull what you pushed from the Claude Code app (skip cleanly if offline).
echo "==> updating repo"
git -C "$REPO" pull --ff-only 2>/dev/null || echo "   (skipped pull — offline or local changes)"

# A minimal .env so it runs out of the box. Edit it for live/private data:
#   worldcup -> FOOTBALL_DATA_API_KEY for live scores (DATA_PROVIDER=football_data)
#   family   -> CAL_PROVIDER=ical + ICAL_SOURCES for your real calendars
if [ ! -f "$APP_DIR/.env" ]; then
  echo "==> writing a default $APP_DIR/.env ($DEFAULT_ENV)"
  printf '%s\n' "$DEFAULT_ENV" > "$APP_DIR/.env"
fi

echo "==> install + build ($APP) — first run is the slow one"
( cd "$APP_DIR" && npm install --no-fund --no-audit && npm run build )

# Keep the CPU awake so Android doesn't suspend the server while the screen's off.
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true

echo ""
echo "==> serving '$APP' — open http://localhost:$PORT in your phone browser"
echo "    (set HOST=0.0.0.0 to reach it from another device on your wifi; Ctrl-C to stop)"
( cd "$APP_DIR" && exec npm start )
