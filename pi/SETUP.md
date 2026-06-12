# Dusty Pi → Dashboard on the TV

A from-scratch guide. Assumes you haven't touched the Pi in a while and want the
cleanest path: a fresh OS flash, then this dashboard auto-starting full-screen on
the TV after every reboot.

Budget ~45–60 minutes, most of it waiting on downloads.

---

## 0. What you need

- The Raspberry Pi + its power supply
- A **microSD card** (16GB+; you'll re-flash it, so back up anything on it first)
- A way to write the SD card from your laptop (built-in slot or a USB adapter)
- The right **HDMI cable for your model** — this trips people up:
  - **Pi 4 and Pi 5** have **micro-HDMI** ports → you need a *micro-HDMI-to-HDMI* cable or adapter
  - **Pi 3** has a **full-size HDMI** port → a normal HDMI cable
- Wi-Fi name + password (or an ethernet cable)
- Optional but recommended: a USB keyboard for first boot (you can also go fully headless over SSH — see step 3)

Don't know which Pi you have? The model is printed on the board, or check later with
`cat /proc/device-tree/model`.

---

## 1. Flash a fresh Raspberry Pi OS

Re-flashing is faster and more reliable than reviving an old install.

1. Install **Raspberry Pi Imager** on your laptop: https://www.raspberrypi.com/software/
2. Insert the SD card.
3. In Imager:
   - **Choose Device:** your Pi model
   - **Choose OS:** *Raspberry Pi OS (64-bit)* — the full **Desktop** version (not Lite).
     Desktop is much easier to debug for a kiosk.
   - **Choose Storage:** your SD card
4. Click **Next → Edit Settings** (the gear / "would you like to apply customisation"). This is the
   big time-saver — set it all now so the Pi comes up ready:
   - **Hostname:** `worldcup` (then you can reach it at `worldcup.local`)
   - **Username / password:** pick something you'll remember (e.g. user `pi`)
   - **Wireless LAN:** your Wi-Fi SSID + password + country
   - **Locale / timezone:** `America/Los_Angeles`
   - **Services tab:** ✅ **Enable SSH** → "Use password authentication"
5. **Write**, wait, eject.

> The username you choose matters later — this guide assumes `pi` and a home at `/home/pi`.
> If you pick something else, adjust the paths.

---

## 2. First boot

1. Put the SD card in the Pi, connect **HDMI to the TV**, switch the TV to that HDMI input.
2. Plug in power. First boot takes a few minutes and may reboot itself once.
3. You should land on the Raspberry Pi OS desktop.

If the TV shows "No signal": confirm you're on the right HDMI input and that the cable is in the
**micro-HDMI port nearest the USB-C power** on a Pi 4/5 (that's HDMI0).

---

## 3. Get a terminal (two options)

**Option A — directly on the Pi:** open the Terminal app from the taskbar. Need a USB keyboard.

**Option B — headless over SSH from your laptop (recommended, easier to paste commands):**

```bash
ssh pi@worldcup.local
```

If `worldcup.local` doesn't resolve, find the Pi's IP from your router and use `ssh pi@<ip>`.

Everything from here can be done in that terminal.

---

## 4. Update the OS and install dependencies

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y git curl chromium unclutter
```

(On older Pi OS the browser package is `chromium-browser` instead of `chromium` — install whichever
exists; the launch script handles either name.)

Install **Node 20 LTS** from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # should print v20.x
```

---

## 5. Get the dashboard and build it

```bash
git clone <your-repo-url> ~/world-cup-dashboard
cd ~/world-cup-dashboard
./scripts/build-kiosk.sh        # installs deps, builds client+server, validates data
```

Quick manual smoke test before wiring autostart:

```bash
npm run start &                 # start the server in the background
sleep 3
curl -s http://localhost:3000/healthz   # -> {"ok":true}
```

Leave it running for the next step, or `kill %1` to stop it.

> Want live fixtures instead of the bundled sample data? Use the OpenFootball provider — set
> `Environment=DATA_PROVIDER=openfootball` in the service file in step 6.

---

## 6. Run the server as a background service

This keeps the dashboard server alive across crashes and reboots, no login required.

```bash
mkdir -p ~/.config/systemd/user
cp pi/dashboard.service.example ~/.config/systemd/user/worldcup-dashboard.service

# Allow user services to run at boot without an interactive login:
sudo loginctl enable-linger "$USER"

systemctl --user daemon-reload
systemctl --user enable --now worldcup-dashboard.service
systemctl --user status worldcup-dashboard.service --no-pager   # should be "active (running)"
```

To use live data, edit the service first and change/add the `DATA_PROVIDER` line, then
`systemctl --user daemon-reload && systemctl --user restart worldcup-dashboard.service`.

---

## 7. Make the TV behave like an appliance

Use `raspi-config` for the two settings that matter most:

```bash
sudo raspi-config
```

- **System Options → Boot / Auto Login → Desktop Autologin** — so a reboot goes straight to the
  desktop (and then the kiosk) with no login prompt.
- **Display Options → Screen Blanking → Disable** — so the TV never goes black from the Pi side.
  (This is the reliable way on current Pi OS, whether it's running Wayland or X11.)

Reboot when it offers to.

---

## 8. Launch the kiosk and confirm it works *manually* first

Don't wire autostart until you've seen it work once by hand.

```bash
cd ~/world-cup-dashboard
chmod +x pi/chromium-launch.sh
./pi/chromium-launch.sh
```

Chromium should fill the screen with the dashboard. The mouse cursor disappears after a moment
(`unclutter`). Press **Ctrl+W** or **Alt+F4** to exit, or from another SSH session `pkill chromium`.

If it works → continue. If not → see Troubleshooting below before automating.

---

## 9. Auto-start the kiosk on boot

Add an XDG autostart entry so the desktop session launches the kiosk:

```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/worldcup-kiosk.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=World Cup Kiosk
Exec=/home/pi/world-cup-dashboard/pi/chromium-launch.sh
X-GNOME-Autostart-enabled=true
EOF
```

Adjust `/home/pi` if your username differs.

**Now the real test:**

```bash
sudo reboot
```

After it comes back up the TV should show the dashboard full-screen, no cursor, no login. That's the
finish line.

---

## 10. Day-to-day

- **Switch between the dashboard and a game:** just change the TV's input with the Roku remote. The
  Pi keeps running on its own HDMI input.
- **Edit data / channel notes:** SSH in and edit `data/manual/*.json` (or `overrides.json`). Changes
  show within ~60s; no restart needed.
- **Update the app after a code change:**
  ```bash
  cd ~/world-cup-dashboard && git pull && npm run build
  systemctl --user restart worldcup-dashboard.service
  ```
- **Server logs:** `journalctl --user -u worldcup-dashboard -f`

---

## Troubleshooting

**Chromium doesn't appear / kiosk autostart does nothing.**
Check whether the desktop is Wayland or X11:
```bash
echo $XDG_SESSION_TYPE          # "wayland" or "x11"
```
- The XDG `autostart/*.desktop` entry works under both the Wayfire and labwc Wayland sessions used on
  current Pi OS, and under X11. If nothing launches, try the compositor's own autostart instead:
  - **Wayfire (Pi 4/5 default):** add to `~/.config/wayfire.ini` under an `[autostart]` section:
    `kiosk = /home/pi/world-cup-dashboard/pi/chromium-launch.sh`
  - **labwc:** add the script path to `~/.config/labwc/autostart`
- As a last resort, switch to X11: `sudo raspi-config` → **Advanced Options → Wayland → X11**, reboot,
  and the XDG autostart + the `xset` screen-blank disables in the launch script will all behave.

**TV goes black after a while.** Screen blanking — redo step 7's "Screen Blanking → Disable", reboot.

**Dashboard shows but says "Data stale" / fallback.** The server isn't reachable or the provider
failed. Check `systemctl --user status worldcup-dashboard` and `journalctl --user -u worldcup-dashboard`.
Manual mode needs no network; only `openfootball` mode needs internet.

**Wrong resolution / edges cut off (overscan).** `sudo raspi-config` → **Display Options** → set
resolution or toggle overscan. Many TVs also have a "Just Scan" / "1:1 pixel" picture setting that
fixes cut-off edges.

**`worldcup.local` won't resolve for SSH.** Use the IP from your router, or connect a keyboard and
work on the Pi directly.

**Which Pi / OS am I on?**
```bash
cat /proc/device-tree/model        # e.g. "Raspberry Pi 4 Model B Rev 1.5"
cat /etc/os-release | head -2      # OS version (Bookworm, etc.)
```
