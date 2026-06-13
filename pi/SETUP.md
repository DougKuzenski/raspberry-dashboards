# Raspberry Pi Kiosk Setup

From a fresh SD card to a dashboard auto-starting full-screen on the TV, hands-free —
and able to **swap between dashboards with a one-line commit**.

The Pi runs **both** dashboard servers side by side (World Cup on :3000, family on :3001)
and **one** app-agnostic kiosk (**cage + cog** — a kiosk Wayland compositor + the WPE WebKit
browser) that shows whichever dashboard `kiosk.json` selects. Swapping is just flipping that
manifest — the other server is already running, so it's a ~3s reload, no reinstall, no reboot.

Lean enough for a **Pi 2**, great on a **Pi 4/5** — see [Which Pi / upgrading](#which-pi--upgrading-to-a-4-or-5).

Most of the work is one script: [`install-kiosk.sh`](install-kiosk.sh).

---

## 0. What you need

- Raspberry Pi (2/3/4/5) + power supply
- microSD card (16GB+). **Use a good brand** — a worn/cheap card corrupts and is the #1 Pi headache.
- HDMI cable for your model (**Pi 4/5 = micro-HDMI**; Pi 2/3 = full-size HDMI)
- Network: ethernet, or Wi-Fi (Pi 2 has none built-in — use ethernet or a USB Wi-Fi dongle)

## 1. Flash Raspberry Pi OS

Use **Raspberry Pi Imager** → **Raspberry Pi OS (Desktop)** (the installer disables the desktop
later, but it pulls in the Wayland/labwc bits cage relies on).

- **Pi 4/5/3:** 64-bit.   **Pi 2:** **32-bit** (the 64-bit image won't boot on a Pi 2).

In Imager's **Edit Settings**: hostname (e.g. `worldcup`), your user + password, Wi-Fi (if used),
timezone `America/Los_Angeles`, **enable SSH**.

## 2. First boot + SSH in

```bash
ssh <user>@worldcup.local        # or <user>@<ip>
```
(Pi 2 on a USB Wi-Fi dongle: set up over **ethernet** first.)

## 3. Install Node 20

```bash
sudo apt update && sudo apt full-upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y git nodejs
```

## 4. Clone + configure each dashboard you want

```bash
git clone <your-repo-url> ~/raspberry-playground
cd ~/raspberry-playground

# World Cup dashboard (root app):
cp .env.example .env
nano .env        # DATA_PROVIDER=football_data + FOOTBALL_DATA_API_KEY=<key>

# Family calendar dashboard:
cd apps/family && cp .env.example .env
nano .env        # CAL_PROVIDER=ical + ICAL_SOURCES=[{...}]   (one line)
cd ../..
```

You can configure just one if that's all you want — the installer skips an app with no `.env`.

> **Secrets live only on the Pi.** Both `.env` files (the football key, the calendars' secret iCal
> URLs) are gitignored and never pulled. Get the iCal URLs from Google Calendar → the calendar →
> "Secret address in iCal format". Get the football key at football-data.org (verify the email).

## 5. Run the installer

```bash
./pi/install-kiosk.sh
sudo reboot
```

That installs cage/cog + an emoji font, builds each configured app, runs both servers, sets up the
manifest-driven kiosk + a self-update timer + a memory watchdog, adds the passwordless kiosk-reload
rule, and disables the desktop. After the reboot the TV shows the dashboard named in `kiosk.json`
(default: `family`) with **no login and no input needed**.

---

## Swapping which dashboard is on the TV

`kiosk.json` (repo root) is the single source of truth:

```json
{ "active": "family" }
```

**The easy way** — from your laptop, one command (commits the manifest + applies it on the Pi):

```bash
./pi/switch.sh worldcup      # or:  make swap APP=worldcup
./pi/switch.sh family        #      make swap APP=family
```

**The manual way** — edit `kiosk.json`, commit, push. The Pi's self-update timer applies it within
~10 min (or run `./pi/deploy.sh` to apply now). Either path is a ~3s cog reload onto the
already-running other server — no rebuild, no reboot.

## The deploy loop (code changes)

`main` is the deploy branch. Edit code on your laptop → push to `main` → the Pi picks it up:

- **Automatic:** the self-update timer checks every ~10 min and, on new commits, rebuilds the
  changed app(s), restarts their servers, and reloads the kiosk.
  Watch it: `journalctl --user -u dashboard-auto-update -f`.
- **Now:** `./pi/deploy.sh` (or `make deploy`) applies the latest `main` immediately.

A failed build leaves the running version up (the restart is gated on a successful build), so a bad
push won't black out the TV.

## How it works

```
boot → (no desktop) → dashboard-kiosk.service on tty1
        → cage → pi/kiosk-launch.sh reads kiosk.json → exec cog http://localhost:<port>
worldcup-dashboard.service (:3000)  ┐  both user services, started at boot (linger)
family-dashboard.service   (:3001)  ┘  config from each app's .env
dashboard-auto-update.timer  → git pull + build changed apps + reload kiosk
dashboard-mem-guard.timer    → restart the kiosk if free RAM < 160MB
```

- **Servers:** `systemctl --user status worldcup-dashboard family-dashboard`
- **Kiosk:** `systemctl status dashboard-kiosk`
- **Logs:** `journalctl --user -u worldcup-dashboard -f`, `sudo journalctl -u dashboard-kiosk -f`
- **See the screen over SSH (no monitor):**
  `sudo apt install -y grim; XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0 grim /tmp/shot.png`

---

## Which Pi / upgrading to a 4 or 5

**Keep this exact setup on every model — including a Pi 4/5.** It's lean (cog ≈ 70MB, two servers
≈ 70MB each), boots fast, and cog gets **hardware acceleration automatically** on a Pi 4/5 (just
smoother — no config change). To migrate: flash 64-bit OS, clone, create the `.env`(s), run
`./pi/install-kiosk.sh`. Nothing here is Pi-2-specific.

**Don't go back to Chromium.** cog renders these apps fine. Chromium's failures were Pi-2-specific
(no GPU → black; labwc → invisible window), not a cog limitation. If you ever truly need Chromium
on a Pi 4/5 for some other page, run it **under cage** with the GPU on (`cage -- chromium
--ozone-platform=wayland --kiosk <url>`, no `--disable-gpu`).

## Why cage + cog (and not desktop + Chromium)

Hard-won on the Pi 2, kept because it's the better kiosk design:

- Chromium under labwc never showed a window; under cage it rendered pure black (no usable GPU);
  and it leaked to all RAM+swap in ~4h. cog stays flat at ~70MB.
- cog needs `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (bubblewrap can't init on the Pi kernel)
  and `fonts-noto-color-emoji` (so flags render). Both handled by the installer.
- cage must run on the **active VT** to be granted the display, so the kiosk service does `chvt 1` first.

## Troubleshooting

- **Black screen:** `sudo journalctl -u dashboard-kiosk -n 50`; capture with `grim` (above). If the
  active app's server isn't up, the launcher waits forever — check `systemctl --user status <app>-dashboard`.
- **Wrong VT / nothing on TV:** `sudo fgconsole` should be `1`; `sudo systemctl restart dashboard-kiosk`.
- **Edges cut off (overscan):** fix on the TV ("Just Scan / 1:1 pixel") or `raspi-config` → Display.
- **Don't run `apt install` while the kiosk is busy on a Pi 2** — concurrent heavy load can OOM-freeze
  it. `sudo systemctl stop dashboard-kiosk` first.
