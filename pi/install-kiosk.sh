#!/usr/bin/env bash
#
# One-shot, re-runnable installer for the dashboard kiosk on Raspberry Pi OS
# (Bookworm/Trixie, labwc/Wayland). Sets up a MANIFEST-DRIVEN kiosk:
#
#   - BOTH dashboard servers run side by side as user services (worldcup :3000,
#     family :3001), started at boot via linger. (An app is skipped if it has no .env.)
#   - ONE app-agnostic kiosk (cage + cog) shows whichever dashboard kiosk.json
#     selects. Swapping is a one-line manifest change — see pi/switch.sh — not a
#     reinstall: the other server is already running, so it's a ~3s cog reload.
#   - A self-update timer (git pull + rebuild changed apps + reload kiosk) and a
#     memory watchdog (restart the kiosk if RAM runs low).
#
# Re-runnable: safe to run again after pulling new code or adding a second app's .env.
#
# WHY cage + cog instead of Chromium? See pi/SETUP.md. Short version: Chromium
# won't composite a visible window under labwc, and on a GPU-less Pi 2 it renders
# black and leaks itself to death. cog (WPE WebKit) software-renders reliably at
# ~70MB and gets GPU acceleration on a Pi 4/5.
#
# Prereqs: Node 20+, and a .env in each app you want (repo root for worldcup,
#          apps/family for family). Then:  ./pi/install-kiosk.sh   and  sudo reboot
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="$(id -un)"
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "ERROR: Node not found. Install Node 20 LTS first."; exit 1; }

echo "==> repo: $REPO   user: $USER_NAME"

echo "==> installing packages (cage, cog, emoji font)"
sudo apt-get update -y
sudo apt-get install -y cage cog fonts-noto-color-emoji curl
sudo fc-cache -f >/dev/null 2>&1 || true

mkdir -p "$HOME/.config/systemd/user"
chmod +x "$REPO/pi/kiosk-launch.sh" "$REPO/pi/auto-update.sh" 2>/dev/null || true

# --- one dashboard server (user service) per app that has a .env ---
setup_server() {  # name  app-dir  service  port
  local name="$1" dir="$2" service="$3" port="$4"
  if [ ! -f "$dir/.env" ]; then
    echo "==> skipping $name server (no $dir/.env)"
    return 0
  fi
  echo "==> building $name ($dir) + server service on :$port"
  ( cd "$dir" && ( npm ci || npm install ) && npm run build )
  cat > "$HOME/.config/systemd/user/$service.service" <<EOF
[Unit]
Description=$name dashboard server (:$port)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$dir
ExecStart=$NODE_BIN $dir/dist/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
  systemctl --user enable "$service.service"
}

setup_server worldcup "$REPO"             worldcup-dashboard 3000
setup_server family   "$REPO/apps/family" family-dashboard   3001

systemctl --user daemon-reload
# (re)start whatever servers got installed
[ -f "$REPO/.env" ]             && systemctl --user restart worldcup-dashboard.service || true
[ -f "$REPO/apps/family/.env" ] && systemctl --user restart family-dashboard.service   || true
sudo loginctl enable-linger "$USER_NAME"

# --- memory watchdog: restart the kiosk if free RAM gets low ---
echo "==> memory watchdog"
sudo tee /usr/local/bin/dashboard-mem-guard.sh >/dev/null <<'GUARD'
#!/bin/sh
avail=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
if [ "${avail:-9999}" -lt 160 ]; then
  logger -t dashboard-mem-guard "MemAvailable ${avail}MB < 160MB; restarting kiosk"
  systemctl restart dashboard-kiosk.service
fi
GUARD
sudo chmod +x /usr/local/bin/dashboard-mem-guard.sh
sudo tee /etc/systemd/system/dashboard-mem-guard.service >/dev/null <<'SVC'
[Unit]
Description=Dashboard kiosk memory guard
[Service]
Type=oneshot
ExecStart=/usr/local/bin/dashboard-mem-guard.sh
SVC
sudo tee /etc/systemd/system/dashboard-mem-guard.timer >/dev/null <<'TMR'
[Unit]
Description=Run dashboard kiosk memory guard every 10 min
[Timer]
OnBootSec=10min
OnUnitActiveSec=10min
[Install]
WantedBy=timers.target
TMR

# --- the one kiosk: cage runs the manifest launcher, which becomes cog ---
echo "==> kiosk service (cage + cog, manifest-driven)"
sudo tee /etc/systemd/system/dashboard-kiosk.service >/dev/null <<EOF
[Unit]
Description=Dashboard Kiosk (cage + cog, manifest-driven)
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
ExecStart=/usr/bin/cage -- $REPO/pi/kiosk-launch.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- let auto-update / switch reload the kiosk unattended (passwordless) ---
echo "==> sudoers rule for unattended kiosk reload"
echo "$USER_NAME ALL=(root) NOPASSWD: /usr/bin/systemctl restart dashboard-kiosk.service, /usr/bin/systemctl restart dashboard-kiosk" \
  | sudo tee /etc/sudoers.d/dashboard-kiosk >/dev/null
sudo chmod 0440 /etc/sudoers.d/dashboard-kiosk
sudo visudo -c >/dev/null

# --- self-update timer (app-agnostic) ---
echo "==> self-update timer (every 10 min)"
cat > "$HOME/.config/systemd/user/dashboard-auto-update.service" <<EOF
[Unit]
Description=Dashboard self-update (git pull + build changed apps + reload kiosk)

[Service]
Type=oneshot
ExecStart=$REPO/pi/auto-update.sh
EOF
cat > "$HOME/.config/systemd/user/dashboard-auto-update.timer" <<'EOF'
[Unit]
Description=Check for dashboard updates every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
RandomizedDelaySec=1min

[Install]
WantedBy=timers.target
EOF

# --- retire the old per-app units (superseded by the single kiosk) ---
echo "==> disabling desktop + legacy per-app kiosks"
sudo systemctl disable lightdm 2>/dev/null || true
for u in worldcup-kiosk family-kiosk worldcup-mem-guard.timer family-mem-guard.timer; do
  sudo systemctl disable "$u" 2>/dev/null || true
done

# --- enable everything ---
sudo systemctl daemon-reload
sudo systemctl enable dashboard-mem-guard.timer dashboard-kiosk.service
systemctl --user daemon-reload
systemctl --user enable dashboard-auto-update.timer

# --- sanity: warn if the active app has no server ---
ACTIVE="$("$NODE_BIN" -e 'try{process.stdout.write(String(require(process.argv[1]).active||""))}catch(e){}' "$REPO/kiosk.json" 2>/dev/null || true)"
case "$ACTIVE" in
  worldcup) [ -f "$REPO/.env" ]             || echo "WARNING: kiosk.json active=worldcup but no $REPO/.env — the TV will be blank until you add it." ;;
  family)   [ -f "$REPO/apps/family/.env" ] || echo "WARNING: kiosk.json active=family but no $REPO/apps/family/.env — the TV will be blank until you add it." ;;
  *)        echo "WARNING: kiosk.json active='$ACTIVE' not recognized; kiosk will default to worldcup." ;;
esac

echo ""
echo "Done. Active dashboard: '${ACTIVE:-worldcup}'. Reboot to launch hands-free:  sudo reboot"
echo "Swap anytime:  ./pi/switch.sh <worldcup|family>   (from your laptop)"
echo "Debug the screen:  XDG_RUNTIME_DIR=/run/user/\$(id -u) WAYLAND_DISPLAY=wayland-0 grim /tmp/shot.png"
