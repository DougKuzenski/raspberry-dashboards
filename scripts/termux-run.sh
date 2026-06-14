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
#   pkg install -y nodejs git esbuild
# See docs/termux.md for the full walkthrough and gotchas.
set -euo pipefail

APP="${1:-worldcup}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

case "$APP" in
  worldcup) APP_DIR="$REPO";             PORT=3000; DEFAULT_ENV="DATA_PROVIDER=openfootball" ;;
  family)   APP_DIR="$REPO/apps/family"; PORT=3001; DEFAULT_ENV="CAL_PROVIDER=manual" ;;
  *) echo "unknown app '$APP' (expected: worldcup | family)" >&2; exit 1 ;;
esac

# The npm-shipped esbuild binary doesn't run under Termux; point vite/tsx at the
# system one (pkg install esbuild). Harmless elsewhere (e.g. proot Debian, where
# the normal binary works and this just isn't found).
if command -v esbuild >/dev/null 2>&1; then
  export ESBUILD_BINARY_PATH="$(command -v esbuild)"
fi

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
