# Raspberry Pi Kiosk Setup

From a fresh SD card to the dashboard auto-starting full-screen on the TV, hands-free.

The display runs as **cage + cog** (a tiny kiosk Wayland compositor + the WPE WebKit
browser) instead of a desktop + Chromium. This is lean enough for a **Pi 2** and works
great on a **Pi 4/5** — see [Which Pi / upgrading](#which-pi--upgrading-to-a-4-or-5).

Most of the work is one script: [`install-kiosk.sh`](install-kiosk.sh).

---

## 0. What you need

- Raspberry Pi (2/3/4/5) + power supply
- microSD card (16GB+). **Use a good brand** — a worn/cheap card corrupts and is the #1 Pi headache.
- HDMI cable for your model (**Pi 4/5 = micro-HDMI**; Pi 2/3 = full-size HDMI)
- Network: ethernet, or Wi-Fi (Pi 2 has none built-in — use ethernet or a USB Wi-Fi dongle)

## 1. Flash Raspberry Pi OS

Use **Raspberry Pi Imager**. Pick **Raspberry Pi OS (Desktop)** — the installer disables the
desktop later, but Desktop pulls in the Wayland/labwc bits cage relies on.

- **Pi 4/5/3:** 64-bit.
- **Pi 2:** **32-bit** (the 64-bit image won't boot on a Pi 2).

In Imager's **Edit Settings** (the gear), pre-set: hostname (e.g. `worldcup`), your user +
password, Wi-Fi (if used), timezone `America/Los_Angeles`, and **enable SSH**. This makes the
Pi come up ready for headless setup.

## 2. First boot + SSH in

Connect HDMI + power, let it boot, then from your laptop:

```bash
ssh <user>@worldcup.local        # or <user>@<ip> from your router
```

(Pi 2 on a USB Wi-Fi dongle: set up over **ethernet** first; old dongles can need extra firmware.)

## 3. Install Node 20

```bash
sudo apt update && sudo apt full-upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y git nodejs
```

## 4. Clone + configure

```bash
git clone <your-repo-url> ~/raspberry-playground
cd ~/raspberry-playground
cp .env.example .env
nano .env        # set DATA_PROVIDER=football_data and FOOTBALL_DATA_API_KEY=<your key>
```

> **The API key lives only on the Pi** — `.env` is gitignored, so it does NOT arrive via `git pull`.
> Get a free key at https://www.football-data.org/client/register and **verify the email** (they
> delete inactive keys). No key? Use `DATA_PROVIDER=openfootball` (fixtures only) or `manual`.

## 5. Run the installer

```bash
./pi/install-kiosk.sh
sudo reboot
```

That's it. The script installs cage/cog + an emoji font, builds the app, sets up the server +
kiosk + memory-watchdog services, disables the desktop, and enables everything. After the reboot
the TV shows the dashboard with **no login and no input needed**.

---

## How it works

```
boot → (no desktop) → worldcup-kiosk.service on tty1
        → cage (kiosk compositor) → cog (WPE WebKit) → http://localhost:3000
worldcup-dashboard.service (user, linger) → Express server serves the dashboard
wc-mem-guard.timer → restarts the kiosk if free RAM drops below 160MB
```

- **Server:** `systemctl --user status worldcup-dashboard` — config from `~/raspberry-playground/.env`.
- **Display:** `systemctl status worldcup-kiosk` — cage + cog on tty1.
- **Logs:** `journalctl --user -u worldcup-dashboard -f` and `sudo journalctl -u worldcup-kiosk -f`.

### Day-to-day

- **Switch between dashboard and a game:** just change the TV input with the Roku remote.
- **Edit data / channel notes:** SSH in, edit `data/manual/*.json` (or `overrides.json`) — shows within ~60s.
- **Update after code changes:** `cd ~/raspberry-playground && git pull && npm run build && sudo systemctl restart worldcup-kiosk`
- **See what's on screen over SSH (no monitor needed):**
  ```bash
  sudo apt install -y grim
  XDG_RUNTIME_DIR=/run/user/$(id -u) WAYLAND_DISPLAY=wayland-0 grim /tmp/shot.png
  ```

---

## Which Pi / upgrading to a 4 or 5

**Keep this same cage + cog setup on every model — including a Pi 4/5.** Reasons:

- It already works and is **lean** (cog ≈ 70MB), so it boots fast and leaves headroom.
- cog (WPE WebKit) renders this dashboard perfectly and gets **hardware acceleration
  automatically** on a Pi 4/5's GPU — it just gets smoother, no config change.
- The exact same `install-kiosk.sh` runs on a Pi 4/5. To migrate: flash a 64-bit OS on the new
  Pi, clone, create `.env`, run the script. Done. Nothing in this repo is Pi-2-specific.

**Do you need to go back to Chromium on a Pi 4/5?** No. Chromium only ever offered "broader site
compatibility," and cog renders our React app fine. The earlier Chromium attempts failed for
Pi-2-specific reasons (no GPU → black screen; labwc → invisible window), *not* because cog is a
compromise. If you ever truly need Chromium for some other page on a Pi 4/5, run it **under cage**
(so it gets the display cleanly) and **with** the GPU (do not pass `--disable-gpu`):

```
ExecStart=/usr/bin/cage -- /usr/bin/chromium --ozone-platform=wayland --kiosk http://localhost:3000
```

But for this project, leave it on cog.

---

## Why cage + cog (and not the desktop + Chromium)

Hard-won on the Pi 2, kept because it's simply the better kiosk design:

- **Chromium under labwc never showed a window** (Wayland: no surface; X11/Xwayland: a window that
  wouldn't come to the foreground even when force-raised).
- **Chromium under cage rendered pure black** — the Pi 2 has no usable GPU and Chromium's software
  (SwiftShader) compositing fails on armv7.
- **Chromium also leaked** to ~all RAM+swap in ~4 hours → black screen. cog stays flat at ~70MB.
- cog needed two fixes: `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` (bubblewrap can't init on the
  Pi kernel) and `fonts-noto-color-emoji` (so the flag emoji render).
- cage must run on the **active VT** to be granted the display, so the service does `chvt 1` first.

## Troubleshooting

- **Black screen:** check `sudo journalctl -u worldcup-kiosk -n 50`. Capture the actual output with
  `grim` (above). If cog is crash-looping, the sandbox env var is the usual cause.
- **Nothing on the TV / wrong VT:** `sudo fgconsole` should be `1`; `sudo systemctl restart worldcup-kiosk`.
- **Edges cut off (overscan):** fix on the TV (a "Just Scan / 1:1 pixel" picture setting) or `raspi-config` → Display.
- **Don't run `apt install` while the kiosk is up on a Pi 2** — concurrent heavy load can OOM-freeze
  it. Stop it first: `sudo systemctl stop worldcup-kiosk`.
