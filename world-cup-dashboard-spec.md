# World Cup Ambient Dashboard — Spec and Implementation Plan

## 1. Project Summary

Build a Raspberry Pi-powered ambient World Cup dashboard for a small Roku TV. The Roku TV remains the primary appliance for watching matches through FOX One, Roku, antenna, or other streaming apps. The Raspberry Pi runs a full-screen local web dashboard over HDMI for the “no game is currently on” state.

The first version should be simple, reliable, and useful in the kitchen/living-room context: large readable text, local kickoff times, next matches, group standings, and later a bracket view. The system should boot directly into the dashboard and require little or no maintenance during the tournament.

## 2. Goals

### Primary goals

- Display an always-on World Cup dashboard when no match is being watched.
- Show today’s matches, live/in-progress matches, upcoming matches, and recent results.
- Show local kickoff times in Pacific Time.
- Show group standings during the group stage.
- Show a knockout bracket once knockout rounds begin.
- Run full-screen on a Raspberry Pi connected by HDMI to a Roku TV.
- Be easy to control through simple files/configuration rather than a fragile custom app.

### Secondary goals

- Make the project fun to tinker with without making it unreliable.
- Support a “manual fallback” data mode if live APIs are annoying or rate-limited.
- Keep the architecture simple enough to work through in Claude Code.
- Avoid building a Roku channel or depending on Roku app internals.

## 3. Non-Goals

- Do not build a Roku app/channel.
- Do not attempt to automate Roku input switching in v1.
- Do not scrape copyrighted video streams or circumvent streaming services.
- Do not require paid sports data in v1.
- Do not build a full fantasy/statistics app.
- Do not optimize for mobile first; this is a TV dashboard.

## 4. Recommended Architecture

```text
World Cup data source
  ↓
Node/Express backend or static JSON fetcher
  ↓
Local normalized data cache
  ↓
React/Vite frontend dashboard
  ↓
Chromium kiosk mode on Raspberry Pi
  ↓
HDMI input on Roku TV
```

Recommended implementation:

- Frontend: Vite + React + TypeScript
- Styling: plain CSS modules or simple global CSS
- Backend: Node.js + Express
- Data cache: local JSON files under `data/cache/`
- Runtime: Raspberry Pi OS Desktop, Chromium kiosk mode
- Process manager: systemd user service or pm2

This is intentionally boring. Boring is good here.

## 5. User Experience

### TV behavior

The TV has at least two useful states:

1. Roku input/app state for actual games.
2. Raspberry Pi HDMI input for the dashboard.

The user manually switches inputs using the Roku remote.

### Dashboard states

The dashboard should choose its main layout based on tournament state.

#### During group stage

Priority order:

1. Live matches, if any.
2. Today’s remaining matches.
3. Recently completed matches from today.
4. Next upcoming matches.
5. Group standings.

#### Between match windows

Priority order:

1. “Next match starts in…”
2. Next 3–5 matches.
3. Recent results.
4. Standings or bracket.

#### Knockout stage

Priority order:

1. Bracket.
2. Live or next knockout match.
3. Recent results.
4. Remaining schedule.

## 6. Screen Layout

### Design principles

- Must be readable from across a kitchen/family room.
- Favor large cards over dense tables.
- Avoid tiny footnotes, flags-only interfaces, and scrolling text.
- Use high contrast.
- Design for 720p and 1080p.
- Avoid anything that can burn in badly if left all day: subtly shift/refresh layout if practical.

### Suggested default screen

```text
┌────────────────────────────────────────────────────────────┐
│ WORLD CUP 2026                            Thu Jun 11  3:24 │
├────────────────────────────────────────────────────────────┤
│ NEXT MATCH                                                   │
│ Mexico vs South Africa                                      │
│ 5:00 PM PT · FOX / FOX One                                  │
│ Starts in 1h 36m                                            │
├─────────────────────────────┬──────────────────────────────┤
│ TODAY                       │ GROUP / BRACKET               │
│ 12:00 PM  Match A  Final    │ Group A                       │
│ 3:00 PM   Match B  Live     │ 1. Team X  3 pts              │
│ 6:00 PM   Match C  Upcoming │ 2. Team Y  1 pt               │
├─────────────────────────────┴──────────────────────────────┤
│ UP NEXT: Fri 9:00 AM · Fri 12:00 PM · Fri 5:00 PM           │
└────────────────────────────────────────────────────────────┘
```

### v1 layout sections

- Header
  - Tournament label
  - Current date/time
  - Optional phase label: Group Stage, Round of 32, Round of 16, etc.
- Hero card
  - Live match if one exists; otherwise next upcoming match.
- Today column
  - Today’s matches in local time.
- Context panel
  - Group table during group stage.
  - Bracket during knockout stage.
- Footer ticker
  - Upcoming matches, recent results, or manual notes.

## 7. Data Sources

Use a provider abstraction so the app can swap data sources without rewriting the UI.

### Candidate sources

#### Option A: OpenFootball JSON

OpenFootball provides public-domain football/world cup JSON datasets and is useful for fixtures and historical/static data. It may be less suitable for live scores unless the repo is actively updated during the tournament.

Use for:

- Static schedule
- Teams
- Groups
- Initial tournament structure

#### Option B: Free/open World Cup 2026 REST API

There are open-source World Cup 2026 API projects that advertise teams, groups, matches, stadiums, live scores, and standings. Treat these as convenient but not guaranteed production infrastructure.

Use for:

- Live-ish match status
- Standings
- Results

#### Option C: Paid or freemium sports API

Vendors such as Sportmonks, API-Football/API-SPORTS, LiveScore API, and others provide World Cup coverage, live scores, fixtures, and standings. These may require API keys or paid tiers.

Use only if:

- Free data is unreliable.
- You want live scores without tinkering.
- You are willing to manage an API key.

#### Option D: Manual JSON fallback

A local file manually edited during the tournament.

Use for:

- Total reliability.
- Fixing API mistakes.
- Adding TV-channel notes.
- Keeping the family dashboard useful even if live data breaks.

Recommended approach:

1. Build with manual JSON first.
2. Add automatic provider second.
3. Keep manual override forever.

## 8. Data Model

### Match

```ts
export type MatchStatus =
  | 'scheduled'
  | 'pre_match'
  | 'live'
  | 'halftime'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface Match {
  id: string;
  stage: 'group' | 'round_of_32' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';
  group?: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  kickoffUtc: string;
  venue?: string;
  city?: string;
  status: MatchStatus;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  tv?: string;
  stream?: string;
  notes?: string;
}
```

### Team

```ts
export interface TeamRef {
  id: string;
  name: string;
  shortName?: string;
  countryCode?: string;
  flagEmoji?: string;
}
```

### Standing

```ts
export interface Standing {
  group: string;
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number;
}
```

### BracketNode

```ts
export interface BracketNode {
  id: string;
  stage: Match['stage'];
  matchId?: string;
  label: string;
  homeSource: string;
  awaySource: string;
  winnerFeedsTo?: string;
}
```

### DashboardData

```ts
export interface DashboardData {
  generatedAtUtc: string;
  tournamentPhase: string;
  matches: Match[];
  standings: Standing[];
  bracket: BracketNode[];
  manualMessage?: string;
}
```

## 9. File Structure

```text
world-cup-dashboard/
  README.md
  package.json
  .env.example
  .gitignore
  src/
    server/
      index.ts
      providers/
        providerTypes.ts
        manualProvider.ts
        openFootballProvider.ts
        worldCupApiProvider.ts
      normalize/
        normalizeMatch.ts
        calculateStandings.ts
        selectDashboardState.ts
      cache/
        readCache.ts
        writeCache.ts
    client/
      main.tsx
      App.tsx
      components/
        Header.tsx
        HeroMatchCard.tsx
        TodayMatches.tsx
        UpcomingMatches.tsx
        GroupStandings.tsx
        BracketView.tsx
        FooterTicker.tsx
        ConnectionStatus.tsx
      styles/
        global.css
        dashboard.css
    shared/
      types.ts
      time.ts
      constants.ts
  data/
    manual/
      matches.json
      standings.json
      bracket.json
      config.json
    cache/
      dashboard.json
  scripts/
    fetch-data.ts
    validate-data.ts
    build-kiosk.sh
  pi/
    kiosk.service.example
    dashboard.service.example
    chromium-launch.sh
```

## 10. API Endpoints

The local server should expose a tiny API.

### `GET /api/dashboard`

Returns normalized dashboard data.

Response:

```json
{
  "generatedAtUtc": "2026-06-11T22:00:00Z",
  "tournamentPhase": "group",
  "matches": [],
  "standings": [],
  "bracket": [],
  "manualMessage": "Switch to FOX for the next match."
}
```

### `POST /api/refresh`

Optional local-only endpoint to force data refresh.

For v1, this can be skipped. A buttonless dashboard is fine.

### `GET /healthz`

Returns:

```json
{ "ok": true }
```

## 11. Frontend Behavior

### Refresh cadence

- Fetch `/api/dashboard` every 60 seconds.
- Update the visible clock every second client-side.
- If the API fails, keep showing the last good dashboard state and show a small “data stale” indicator.

### Time handling

- Store all kickoff times in UTC.
- Render in `America/Los_Angeles`.
- Use `Intl.DateTimeFormat` rather than manual timezone math.

Example:

```ts
export function formatKickoffPacific(utc: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(utc));
}
```

### Match selection logic

Create `selectDashboardState.ts` that computes:

- `liveMatches`
- `todayMatches`
- `nextMatch`
- `recentResults`
- `featuredGroup`
- `featuredBracketRegion`

Pseudo-logic:

```ts
if liveMatches.length > 0:
  hero = mostImportantLiveMatch
else:
  hero = nextUpcomingMatch

if phase is group:
  contextPanel = standingsForRelevantGroup
else:
  contextPanel = bracket
```

### Visual state rules

- `scheduled`: show kickoff time.
- `pre_match`: show “Starting soon”.
- `live`: show score and minute.
- `halftime`: show score and “HT”.
- `finished`: show final score.
- `postponed/cancelled`: show status text clearly.

## 12. Backend Behavior

### Provider pattern

Create a provider interface:

```ts
export interface DataProvider {
  name: string;
  fetchDashboardData(): Promise<DashboardData>;
}
```

Manual provider reads from `data/manual/*.json`.

Automatic providers fetch external data, normalize it, and return `DashboardData`.

### Provider priority

Recommended startup config:

```text
DATA_PROVIDER=manual
```

Later:

```text
DATA_PROVIDER=worldcup_api
ENABLE_MANUAL_OVERRIDES=true
```

Manual overrides should win over remote data for fields like:

- `tv`
- `stream`
- `notes`
- corrected kickoff time
- corrected team display name
- manual message

### Cache behavior

- On successful fetch, write `data/cache/dashboard.json`.
- On failed fetch, read last cache.
- If both fail, serve a minimal fallback payload with an error message.

## 13. Manual Data Format

### `data/manual/config.json`

```json
{
  "timezone": "America/Los_Angeles",
  "manualMessage": "Use Roku remote to switch to FOX One when the next match starts.",
  "favoriteTeams": ["USA", "MEX", "CAN"],
  "defaultProvider": "manual"
}
```

### `data/manual/matches.json`

```json
[
  {
    "id": "match-001",
    "stage": "group",
    "group": "A",
    "homeTeam": { "id": "MEX", "name": "Mexico", "shortName": "MEX", "flagEmoji": "🇲🇽" },
    "awayTeam": { "id": "RSA", "name": "South Africa", "shortName": "RSA", "flagEmoji": "🇿🇦" },
    "kickoffUtc": "2026-06-11T19:00:00Z",
    "venue": "Estadio Azteca",
    "city": "Mexico City",
    "status": "scheduled",
    "tv": "FOX",
    "stream": "FOX One"
  }
]
```

### `data/manual/standings.json`

```json
[
  {
    "group": "A",
    "team": { "id": "MEX", "name": "Mexico", "shortName": "MEX", "flagEmoji": "🇲🇽" },
    "played": 0,
    "won": 0,
    "drawn": 0,
    "lost": 0,
    "goalsFor": 0,
    "goalsAgainst": 0,
    "goalDifference": 0,
    "points": 0,
    "rank": 1
  }
]
```

## 14. Raspberry Pi Deployment Plan

### Hardware

- Raspberry Pi 4 or 5 preferred.
- Raspberry Pi 3 may work for a simple dashboard.
- HDMI cable.
- MicroSD card, 32 GB or larger.
- Reliable USB-C power supply.
- Optional: small case with passive cooling.

### OS

Use Raspberry Pi OS Desktop for the first version. Desktop is easier than Lite because Chromium and display behavior are simpler to debug.

### Install basics

```bash
sudo apt update
sudo apt install -y git curl chromium-browser unclutter
```

Install Node.js. Recommended: use `nvm` or NodeSource. Keep it boring with Node 20 LTS or newer.

### Clone and install

```bash
git clone <your-repo-url> ~/world-cup-dashboard
cd ~/world-cup-dashboard
npm install
npm run build
```

### Development run

```bash
npm run dev
```

### Production run

```bash
npm run start
```

Server should run at:

```text
http://localhost:3000
```

### Chromium kiosk launch script

Create `pi/chromium-launch.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

unclutter -idle 0.5 -root &

chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  http://localhost:3000
```

Make executable:

```bash
chmod +x pi/chromium-launch.sh
```

### systemd service for dashboard server

Create `~/.config/systemd/user/worldcup-dashboard.service`:

```ini
[Unit]
Description=World Cup Dashboard Server
After=network-online.target

[Service]
Type=simple
WorkingDirectory=%h/world-cup-dashboard
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

Enable:

```bash
systemctl --user daemon-reload
systemctl --user enable worldcup-dashboard.service
systemctl --user start worldcup-dashboard.service
```

### Kiosk autostart

Raspberry Pi OS display/session behavior changes between releases, especially with Wayland vs X11. The practical approach is:

1. First make sure the launch script works manually from the desktop.
2. Then add it to desktop autostart or a user-level systemd service.
3. If Chromium does not appear, confirm whether the Pi is running Wayland or X11.
4. If needed, switch to X11 for a simpler kiosk setup.

Example desktop autostart file:

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/worldcup-kiosk.desktop
```

Contents:

```ini
[Desktop Entry]
Type=Application
Name=World Cup Kiosk
Exec=/home/pi/world-cup-dashboard/pi/chromium-launch.sh
X-GNOME-Autostart-enabled=true
```

Adjust `/home/pi` if your username is different.

## 15. Package Scripts

`package.json` should include:

```json
{
  "scripts": {
    "dev": "concurrently \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite --host 0.0.0.0",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "fetch:data": "tsx scripts/fetch-data.ts",
    "validate:data": "tsx scripts/validate-data.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

## 16. Implementation Phases

## Phase 0 — Repo bootstrap

### Tasks

- Create Vite React TypeScript app.
- Add Express server.
- Add shared TypeScript types.
- Add `/api/dashboard` endpoint returning hardcoded sample data.
- Render the sample dashboard in the browser.

### Acceptance criteria

- `npm run dev` starts the app.
- Browser shows a readable dashboard.
- `/api/dashboard` returns JSON.
- No external data source is required.

## Phase 1 — Manual JSON mode

### Tasks

- Add `data/manual/matches.json`.
- Add `data/manual/standings.json`.
- Add `data/manual/bracket.json`.
- Implement `manualProvider.ts`.
- Validate manual files at startup.
- Show useful error if JSON is malformed.

### Acceptance criteria

- Editing `matches.json` changes the dashboard.
- Dashboard survives a server restart.
- Bad JSON does not crash silently.

## Phase 2 — Core dashboard UI

### Tasks

- Build `Header`.
- Build `HeroMatchCard`.
- Build `TodayMatches`.
- Build `UpcomingMatches`.
- Build `GroupStandings`.
- Build `ConnectionStatus`.
- Add CSS for 1080p TV display.
- Add responsive fallback for laptop testing.

### Acceptance criteria

- Dashboard is readable from 8–12 feet away.
- Clock updates without full refresh.
- Match cards clearly distinguish scheduled/live/final.
- UI still looks okay with 0, 1, or many matches today.

## Phase 3 — Dashboard state selection

### Tasks

- Implement `selectDashboardState.ts`.
- Identify live matches.
- Identify today’s matches in Pacific Time.
- Identify next upcoming match.
- Identify recent final results.
- Choose relevant group standings based on next/live match.

### Acceptance criteria

- If a match is live, it becomes the hero card.
- If no match is live, the next upcoming match becomes the hero card.
- Relevant group appears for the hero match during group stage.

## Phase 4 — Raspberry Pi kiosk

### Tasks

- Install app on Pi.
- Confirm server runs locally.
- Confirm Chromium opens dashboard manually.
- Add server systemd service.
- Add Chromium autostart.
- Disable screen blanking/sleep.
- Hide cursor.

### Acceptance criteria

- Rebooting the Pi eventually shows the dashboard full-screen.
- Mouse cursor is hidden.
- TV does not go black from Pi-side screen blanking.
- Dashboard can recover from server restart.

## Phase 5 — External data provider

### Tasks

- Pick one external provider.
- Implement provider adapter.
- Normalize provider response to internal `DashboardData`.
- Add cache-on-success.
- Add fallback-to-cache-on-failure.
- Add manual overrides.

### Acceptance criteria

- Dashboard updates from external data.
- If external API fails, last good data remains visible.
- Manual TV/channel notes survive external refreshes.

## Phase 6 — Bracket mode

### Tasks

- Add `BracketView` component.
- Add knockout-stage bracket data model.
- Support empty placeholders like “Winner Group A”.
- Replace group standings panel with bracket panel once group stage ends.

### Acceptance criteria

- Bracket renders before teams are known.
- Bracket updates as winners are known.
- Final and semifinal paths are readable on TV.

## Phase 7 — Polish

### Tasks

- Add subtle layout shift or refresh to reduce burn-in risk.
- Add theme file.
- Add favorite-team highlighting.
- Add “switch to FOX/FOX One” hint before match start.
- Add stale-data indicator.
- Add local admin/debug page if desired.

### Acceptance criteria

- Dashboard feels like a polished appliance.
- Important matches are obvious at a glance.
- Failures are visible but not ugly.

## 17. Testing Plan

### Unit tests

Test pure logic:

- Time formatting.
- Match status selection.
- Today/upcoming filtering.
- Standings sorting.
- Manual override merging.

### Manual testing scenarios

Create sample data for:

- No matches today.
- One match live.
- Multiple matches live.
- Match at halftime.
- Match finished today.
- Match tomorrow morning.
- Group standings tie.
- Knockout placeholder match.
- API failure with cache available.
- API failure with no cache.

### TV testing

Check from across the room:

- Can you read team names?
- Can you read kickoff times?
- Is the hero card obvious?
- Is too much information crammed in?
- Does the display look okay muted and unattended?

## 18. Claude Code Work Plan

Use this section as step-by-step prompts/tasks inside Claude Code.

### Prompt 1 — Bootstrap the app

```text
Create a Vite React TypeScript app with an Express backend in the same repo. Use the file structure in this spec. Add shared TypeScript types for Match, TeamRef, Standing, BracketNode, and DashboardData. Implement GET /api/dashboard returning hardcoded sample data. Render a simple full-screen dashboard using that data.
```

### Prompt 2 — Manual provider

```text
Implement a manual data provider that reads data/manual/matches.json, data/manual/standings.json, data/manual/bracket.json, and data/manual/config.json. Validate the JSON shape enough to fail with helpful errors. Wire GET /api/dashboard to use this manual provider.
```

### Prompt 3 — TV dashboard layout

```text
Build the dashboard components: Header, HeroMatchCard, TodayMatches, UpcomingMatches, GroupStandings, FooterTicker, and ConnectionStatus. Style the app for a 1080p TV with large readable text, high contrast, and no scrolling required for normal match days.
```

### Prompt 4 — State selection logic

```text
Implement selectDashboardState.ts. It should determine liveMatches, todayMatches, nextMatch, recentResults, and featuredGroup. If a match is live, use it as the hero. Otherwise use the next upcoming match. During group stage, show standings for the group related to the hero match.
```

### Prompt 5 — Cache and fallback

```text
Add data/cache/dashboard.json. When dashboard data is successfully generated, write it to cache. If provider loading fails, serve the last cached data with a stale/error indicator. If there is no cache, serve a minimal fallback dashboard payload with a manualMessage explaining the problem.
```

### Prompt 6 — Raspberry Pi deployment files

```text
Add pi/chromium-launch.sh, pi/dashboard.service.example, and README instructions for running this app on Raspberry Pi OS Desktop in Chromium kiosk mode. Include commands for installing dependencies, starting the server, enabling systemd user service, and setting up desktop autostart.
```

### Prompt 7 — External provider abstraction

```text
Create a provider abstraction with DataProvider. Keep manualProvider as the default. Add a stub external provider that can later fetch from an API but currently reads sample remote-shaped JSON and normalizes it to DashboardData. Add environment variable DATA_PROVIDER to select the provider.
```

### Prompt 8 — Bracket view

```text
Implement BracketView for knockout rounds. It should support placeholder labels before teams are known and actual match scores once available. Add logic to show GroupStandings during group phase and BracketView during knockout phase.
```

## 19. Environment Variables

`.env.example`:

```bash
PORT=3000
NODE_ENV=development
DATA_PROVIDER=manual
ENABLE_MANUAL_OVERRIDES=true
TIMEZONE=America/Los_Angeles
EXTERNAL_API_BASE_URL=
EXTERNAL_API_KEY=
```

## 20. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Free API disappears or rate limits | Manual JSON mode and cache fallback |
| Pi kiosk autostart is finicky | First verify manual launch, then systemd/autostart |
| World Cup data format changes | Normalize provider data into stable internal model |
| TV text too small | Design for 1080p from the start, test from across room |
| Dashboard crashes during tournament | systemd restart and last-good cache |
| Timezone mistakes | Store UTC, render with `Intl.DateTimeFormat` in `America/Los_Angeles` |
| Roku/Fox app has better features than expected | Keep Pi project optional and input-based |

## 21. Definition of Done for v1

v1 is done when:

- Raspberry Pi boots into a full-screen dashboard.
- Dashboard shows next match, today’s matches, and upcoming matches.
- Match times are shown in Pacific Time.
- Data can be edited manually through JSON files.
- App survives reboot.
- App shows stale/fallback state instead of crashing.
- UI is readable on the small Roku TV from normal viewing distance.

Do not wait for live API integration before calling v1 useful.

## 22. Suggested First Commit Sequence

1. `chore: bootstrap vite react express app`
2. `feat: add shared dashboard data types`
3. `feat: add manual data provider`
4. `feat: render core dashboard layout`
5. `feat: add dashboard state selection logic`
6. `feat: add cache fallback`
7. `docs: add raspberry pi kiosk setup`
8. `feat: add bracket view skeleton`
9. `chore: add sample world cup data`

## 23. Open Questions

Resolve these as you build, not before starting:

- Which exact Pi model will run this?
- Is the dashboard TV 720p or 1080p?
- Do you want flags, team abbreviations, or full names?
- Should the dashboard highlight USA, Mexico, Canada, or family favorites?
- Is manual TV-channel data enough, or do you want provider-based channel mapping?
- Do you want a web admin page for editing notes, or is JSON editing fine?

## 24. Recommended v1 Bias

When in doubt, choose the lower-tech option:

- Manual JSON over live API.
- Big text over clever visuals.
- Static dashboard over animations.
- Local cache over real-time perfection.
- Manual Roku input switching over automation.

The win condition is not “perfect sports app.” The win condition is: the kitchen TV feels like a useful little World Cup command center.
