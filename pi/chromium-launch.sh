#!/usr/bin/env bash
# Launch Chromium in kiosk mode pointed at the local dashboard server.
# Run this manually first to confirm it works before wiring autostart (spec §14).
set -euo pipefail

URL="http://localhost:3000"

# Hide the mouse cursor when idle.
unclutter -idle 0.5 -root &

# Disable screen blanking / DPMS so the TV never goes black from the Pi side.
# (X11 only; harmless to attempt. On Wayland use the compositor's idle settings.)
xset s off || true
xset -dpms || true
xset s noblank || true

# Chromium binary is named chromium-browser on older Raspberry Pi OS, chromium on newer.
CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium)"

exec "$CHROMIUM_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$URL"
