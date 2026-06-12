# World Cup 2026 Ambient Dashboard

An always-on World Cup dashboard for a small kitchen Roku TV, driven by a Raspberry Pi running
Chromium in kiosk mode over HDMI. It shows the next match, today's matches, live scores, group
standings, and a knockout bracket — all in Pacific Time, with large high-contrast text readable from
across the room.

The Roku TV stays the device you actually watch games on (FOX One, antenna, etc). The Pi is just the
"no game is on right now" screen. Switch inputs with the Roku remote.

Design bias: **boring and reliable**. Manual JSON data works out of the box; a live API is optional;
a last-good cache means the TV never shows a crash.

## Quick start (laptop)

```bash
npm install
npm run dev          # client on :5173 (proxies /api to the server on :3000)
```

Open http://localhost:5173. Edit any file in `data/manual/` and refresh to see it change.

Production build + run (what the Pi uses):

```bash
npm run build        # -> dist/client (UI) + dist/server (Express)
npm run start        # serves everything on http://localhost:3000
```

## How it works

```
manual JSON / external API  ->  DataProvider  ->  normalize + selectDashboardState
  ->  cache (data/cache/dashboard.json)  ->  GET /api/dashboard  ->  React dashboard
  ->  Chromium kiosk on the Pi  ->  HDMI -> Roku TV
```

- **Frontend:** Vite + React + TypeScript, plain CSS sized for 720p (scales up to 1080p).
- **Backend:** Express (TypeScript), `GET /api/dashboard`, `GET /healthz`, `POST /api/refresh`.
- **Data providers** (selected by `DATA_PROVIDER`):
  - `manual` (default) — reads `data/manual/*.json`. No network.
  - `openfootball` — **live fetch** of [OpenFootball's public-domain `worldcup.json`](https://github.com/openfootball/worldcup.json)
    (all 104 matches, 48 teams). No API key. Fixtures/groups/schedule are solid, but it's hand-maintained
    (~monthly) so it does **not** give live scores; status is inferred from kickoff time.
  - `football_data` — **live scores + status** from [football-data.org](https://www.football-data.org/) (free
    key required). Real `SCHEDULED/IN_PLAY/PAUSED/FINISHED` status, scores, minute, groups, and knockout stages.
    A 30s server-side cache keeps requests well under the free tier's 10/min. **This is the one to use for live data.**
  - `worldcup_api` — a local sample-remote stub demonstrating the same normalize pipeline (no network).
- **Manual overrides** (`data/manual/overrides.json`, when `ENABLE_MANUAL_OVERRIDES=true`) let a human
  correct TV channel / stream / notes / kickoff time / team name on top of remote data.
- **Cache + fallback:** every successful load writes `data/cache/dashboard.json`. On a failed load the
  server serves the last cache marked `stale`; with no cache it serves a friendly fallback payload.

## Editing the data

| File | Purpose |
|---|---|
| `data/manual/matches.json` | Fixtures, scores, statuses, TV/stream notes |
| `data/manual/standings.json` | Group tables |
| `data/manual/bracket.json` | Knockout bracket nodes (placeholders OK) |
| `data/manual/config.json` | Timezone, manual message, favorite teams |
| `data/manual/overrides.json` | Human corrections applied over an external provider |

Favorite teams (highlighted on screen) default to **USA, MEX, CAN**.

Validate your edits without starting the server:

```bash
npm run validate:data
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run server + client with hot reload |
| `npm run build` | Build client and server to `dist/` |
| `npm run start` | Run the production server on `:3000` |
| `npm run validate:data` | Validate manual JSON files |
| `npm run fetch:data` | Fetch from the active provider and write the cache (e.g. `DATA_PROVIDER=openfootball npm run fetch:data`) |
| `npm test` | Run unit tests (vitest) |
| `npm run typecheck` | Type-check client and server |
| `npm run lint` | Lint |

## Environment

Copy `.env.example` to `.env`:

```bash
PORT=3000
DATA_PROVIDER=manual          # manual | openfootball | football_data | worldcup_api
ENABLE_MANUAL_OVERRIDES=true
TIMEZONE=America/Los_Angeles
EXTERNAL_API_BASE_URL=
EXTERNAL_API_KEY=
FOOTBALL_DATA_API_KEY=        # required for DATA_PROVIDER=football_data
```

For live scores, get a free key at https://www.football-data.org/client/register, then:

```bash
DATA_PROVIDER=football_data FOOTBALL_DATA_API_KEY=your_key npm run dev
```

## Raspberry Pi kiosk setup

**New to this / starting from a dusty Pi?** Follow the full step-by-step walkthrough in
[`pi/SETUP.md`](pi/SETUP.md) — from flashing the SD card to the dashboard auto-starting on the TV.
The condensed version is below.

Use Raspberry Pi OS **Desktop** (easier to debug than Lite). Pi 4 or 5 recommended.

```bash
sudo apt update
sudo apt install -y git curl chromium-browser unclutter
# Install Node 20 LTS (nvm or NodeSource), then:
git clone <your-repo-url> ~/world-cup-dashboard
cd ~/world-cup-dashboard
./scripts/build-kiosk.sh      # install + build + validate
```

**1. Run the server as a user service**

```bash
cp pi/dashboard.service.example ~/.config/systemd/user/worldcup-dashboard.service
systemctl --user daemon-reload
systemctl --user enable --now worldcup-dashboard.service
curl -sf http://localhost:3000/healthz   # -> {"ok":true}
```

**2. Confirm the kiosk launches manually first**

```bash
chmod +x pi/chromium-launch.sh
./pi/chromium-launch.sh
```

**3. Autostart the kiosk.** Easiest is a desktop autostart entry:

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

Adjust `/home/pi` to your username. Alternatively use `pi/kiosk.service.example`.

**Troubleshooting**

- Browser doesn't appear: check whether the Pi is on **Wayland or X11** (`echo $XDG_SESSION_TYPE`).
  The `xset` screen-blank disables in `chromium-launch.sh` are X11-only; on Wayland set idle behavior
  in the compositor. Switching to X11 gives the simplest kiosk setup.
- TV goes black: that's display blanking — handled by the `xset` calls on X11.
- Binary name differs by OS release (`chromium-browser` vs `chromium`); the launch script handles both.

## Project layout

```
src/server/   Express server, providers, normalize logic, cache
src/client/   React dashboard (components + styles)
src/shared/   Types, time helpers, selectDashboardState (used by both)
data/manual/  Hand-maintained JSON (the default data source)
data/sample-remote/  Sample API-shaped JSON for the provider stubs
pi/           Kiosk launch script + systemd unit examples
scripts/      Data validation/fetch + Pi build helper
tests/        Vitest unit tests
```
