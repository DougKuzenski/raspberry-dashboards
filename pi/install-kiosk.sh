#!/usr/bin/env bash
#
# One-shot, re-runnable installer for the World Cup dashboard kiosk on Raspberry Pi
# OS (Bookworm/Trixie, labwc/Wayland). Sets up:
#   - the dashboard server as a user service (starts at boot via linger)
#   - the display as cage + cog (a kiosk compositor + WPE WebKit browser),
#     replacing the desktop — lean enough for a Pi 2, great on a Pi 4/5
#   - a memory watchdog that restarts the kiosk if RAM runs low
#
# WHY cage + cog instead of Chromium? See pi/SETUP.md. Short version: Chromium
# won't composite a visible window under labwc, and on a GPU-less Pi 2 it renders
# black and leaks itself to death. cog (WPE WebKit) software-renders reliably and
# uses ~70MB. This same setup works on a Pi 4/5 too (keep it — see SETUP.md).
#
# Prereqs: Node 20+ installed, and a .env created in the repo root with at least
#          DATA_PROVIDER and (for live scores) FOOTBALL_DATA_API_KEY.
# Usage:   ./pi/install-kiosk.sh   then   sudo reboot
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="$(id -un)"
NODE_BIN="$(command -v node || true)"

echo "==> repo: $REPO   user: $USER_NAME"
[ -n "$NODE_BIN" ] || { echo "ERROR: Node not found. Install Node 20 LTS first."; exit 1; }
[ -f "$REPO/.env" ] || {
  echo "ERROR: $REPO/.env not found.";
  echo "Create it (cp .env.example .env) and set DATA_PROVIDER + FOOTBALL_DATA_API_KEY first.";
  exit 1;
}

echo "==> installing packages (cage, cog, emoji font)"
sudo apt-get update -y
sudo apt-get install -y cage cog fonts-noto-color-emoji curl
sudo fc-cache -f >/dev/null 2>&1 || true

echo "==> building the app"
cd "$REPO"
( npm ci || npm install )
npm run build

echo "==> dashboard server as a user service + linger (starts at boot)"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/worldcup-dashboard.service" <<EOF
[Unit]
Description=World Cup Dashboard Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$NODE_BIN $REPO/dist/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now worldcup-dashboard.service
sudo loginctl enable-linger "$USER_NAME"

echo "==> memory watchdog (restart kiosk if MemAvailable < 160MB)"
sudo tee /usr/local/bin/wc-mem-guard.sh >/dev/null <<'GUARD'
#!/bin/sh
avail=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
if [ "${avail:-9999}" -lt 160 ]; then
  logger -t wc-mem-guard "MemAvailable ${avail}MB < 160MB; restarting kiosk"
  systemctl restart worldcup-kiosk.service
fi
GUARD
sudo chmod +x /usr/local/bin/wc-mem-guard.sh
sudo tee /etc/systemd/system/wc-mem-guard.service >/dev/null <<'SVC'
[Unit]
Description=World Cup kiosk memory guard
[Service]
Type=oneshot
ExecStart=/usr/local/bin/wc-mem-guard.sh
SVC
sudo tee /etc/systemd/system/wc-mem-guard.timer >/dev/null <<'TMR'
[Unit]
Description=Run kiosk memory guard every 10 min
[Timer]
OnBootSec=10min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
TMR

echo "==> kiosk service (cage + cog on tty1)"
sudo tee /etc/systemd/system/worldcup-kiosk.service >/dev/null <<EOF
[Unit]
Description=World Cup Dashboard Kiosk (cage + cog)
After=systemd-user-sessions.service network-online.target
Wants=network-online.target
Conflicts=getty@tty1.service
After=getty@tty1.service

[Service]
Type=simple
User=$USER_NAME
PAMName=login
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
StandardInput=tty
StandardOutput=journal
StandardError=journal
# localhost-only kiosk: WPE WebKit's bubblewrap sandbox can't init on the Pi kernel; disable it.
Environment=WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
# cage only gets the display if its tty is the ACTIVE console — force it.
ExecStartPre=+/usr/bin/chvt 1
ExecStartPre=/bin/sh -c 'until curl -sf http://localhost:3000/healthz >/dev/null 2>&1; do sleep 1; done'
ExecStart=/usr/bin/cage -- /usr/bin/cog http://localhost:3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "==> disabling the desktop, enabling kiosk + watchdog"
sudo systemctl disable lightdm 2>/dev/null || true
sudo systemctl daemon-reload
sudo systemctl enable wc-mem-guard.timer worldcup-kiosk.service

echo ""
echo "Done. Reboot to launch the kiosk hands-free:  sudo reboot"
echo "Debug the screen over SSH:  XDG_RUNTIME_DIR=/run/user/\$(id -u) WAYLAND_DISPLAY=wayland-0 grim /tmp/shot.png"
