# Family Calendar Dashboard

An always-on Raspberry Pi dashboard for a kitchen TV that merges several Google
calendars (Family, School, …) into one color-coded agenda: what's happening now,
what's up next, today's timeline, and the week ahead — in large, across-the-room
type, rendered in one timezone.

Built on the same kiosk pattern as the World Cup dashboard at the repo root:
boring and reliable. Hand-edited JSON works out of the box; live Google data is
optional via secret iCal URLs (no OAuth); a last-good cache means the TV never
shows a crash.

## Quick start

```bash
cd apps/family
npm install
npm run dev          # client on :5174 (proxies /api to the server on :3001)
```

Open http://localhost:5174. Edit `data/manual/events.json` and refresh.

Production build + run (what the Pi uses):

```bash
npm run build && npm run start   # serves everything on http://localhost:3001
```

## Data providers (`CAL_PROVIDER`)

- **`manual`** (default) — reads `data/manual/events.json`. No network.
- **`ical`** — live fetch of Google calendars via their **secret iCal URLs**
  (Google Calendar → Settings → a calendar → "Secret address in iCal format").
  No OAuth, no token refresh — just HTTPS GETs of `.ics` files, which is the
  reliable shape for an unattended kiosk. Configure the calendars to merge in
  `ICAL_SOURCES` (see `.env.example`). A 15-minute cache throttles the network.

The secret iCal URL grants read access to that calendar, so it's a secret: it
lives in `.env` (gitignored), never in the repo.

## Data model

Each event is normalized to a `CalEvent`:

- **Timed** events carry `start`/`end` ISO instants and render in the display zone.
- **All-day** events carry a civil `date` (`YYYY-MM-DD`) and are handled in
  *civil-date space* — never converted to an instant — so an all-day item never
  slides to the previous day in a western timezone (the bug Google's UTC-midnight
  all-day encoding causes).

Events are tagged with a `source` (one per Google calendar) for the color lanes,
and may be flagged `tentative` (Free/transparent), `kind: "flight"`, or
`highlight` (a featured milestone).

## Environment

Copy `.env.example` to `.env`. Key vars: `CAL_PROVIDER`, `TIMEZONE`, `HOST`
(defaults to `127.0.0.1` — set `0.0.0.0` to view off-box), `REFRESH_TOKEN`
(guards `POST /api/refresh`), and `ICAL_SOURCES` for the iCal provider.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server + client with hot reload |
| `npm run build` | Build client + server to `dist/` |
| `npm run start` | Run the production server on `:3001` |
| `npm run validate:data` | Validate `data/manual/events.json` |
| `npm test` | Unit tests (vitest) |
| `npm run typecheck` / `npm run lint` | Type-check / lint |

## Raspberry Pi

Same kiosk approach as the root app — point Chromium at `http://localhost:3001`
and run the server as a systemd user service. See the root `pi/SETUP.md`; only
the port (3001) and `WorkingDirectory` differ.

## Status

This is the first cut: runs on the manual provider, with a working iCal provider
for one-off events and basic `DAILY`/`WEEKLY` recurrence. See `BACKLOG.md` for
what's next (notably `MONTHLY`/`YEARLY` recurrence and per-source TV/weather).
