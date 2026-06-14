#!/usr/bin/env bash
#
# Opt-in installer for the LAN control panel (apps/control) — a phone-reachable
# remote to switch the displayed dashboard, reboot, or shut down the Pi.
#
# Separate from install-kiosk.sh on purpose: the control panel is optional and
# binds to the LAN (the dashboards stay loopback-only), so you enable it
# deliberately. Run AFTER install-kiosk.sh.
#
#   ./pi/install-control.sh        then open http://<pi-host>:8080 from your phone
#
# Re-runnable. Sets up:
#   - apps/control built + run as a user service (dashboard-control.service, :8080)
#   - a narrow sudoers rule letting it run exactly `systemctl reboot` / `poweroff`
#     (kiosk reload is already allowed by install-kiosk.sh's sudoers drop-in)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$REPO/apps/control"
USER_NAME="$(id -un)"
NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "ERROR: Node not found. Install Node 20 LTS first."; exit 1; }

echo "==> building control panel ($DIR)"
( cd "$DIR" && npm install --no-fund --no-audit && npm run build )

echo "==> control panel user service (:8080)"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/dashboard-control.service" <<EOF
[Unit]
Description=Dashboard control panel (LAN remote)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$DIR
ExecStart=$NODE_BIN $DIR/dist/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now dashboard-control.service
sudo loginctl enable-linger "$USER_NAME" 2>/dev/null || true

echo "==> sudoers rule for reboot / shutdown"
echo "$USER_NAME ALL=(root) NOPASSWD: /usr/bin/systemctl reboot, /usr/bin/systemctl poweroff" \
  | sudo tee /etc/sudoers.d/dashboard-control >/dev/null
sudo chmod 0440 /etc/sudoers.d/dashboard-control
# Validate ONLY our drop-in so an unrelated bad sudoers file can't abort the install.
if ! sudo visudo -cf /etc/sudoers.d/dashboard-control >/dev/null; then
  echo "ERROR: generated sudoers file failed validation; removing it." >&2
  sudo rm -f /etc/sudoers.d/dashboard-control
  exit 1
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "Done. Control panel is live:"
echo "  http://$(hostname).local:8080      (or http://${IP:-<pi-ip>}:8080)"
echo "Open it on your phone. It's OPEN by default — set CONTROL_PIN in $DIR/.env to require a PIN."
