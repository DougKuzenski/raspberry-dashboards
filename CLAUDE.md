# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An always-on World Cup 2026 ambient dashboard for a kitchen Roku TV, driven by a Raspberry Pi
running a kiosk browser over HDMI. It shows the next match, today's matches, live scores, group
standings, and a knockout bracket — all in one timezone, with large high-contrast text. Design bias
is **boring and reliable**: manual JSON works with no network, a live API is optional, and a
last-good cache means the TV never shows a crash. See `README.md` and `world-cup-dashboard-spec.md`
for the full product spec (code comments reference spec section numbers like `spec §12`).

## Commands

```bash
npm run dev            # server (:3000) + Vite client (:5173, proxies /api) with hot reload
npm run build          # vite build -> dist/client, tsc -> dist/server
npm run start          # production server on :3000, serves built client + API
npm test               # vitest run (all tests once)
npm run test:watch     # vitest watch mode
npm run typecheck      # type-checks BOTH tsconfigs (client + server) — run before committing
npm run lint           # eslint
npm run validate:data  # validate data/manual/*.json without starting the server
npm run fetch:data     # fetch from the active provider and write the cache
```

Run a single test file or test by name:

```bash
npx vitest run tests/selectDashboardState.test.ts
npx vitest run -t "name of the test"
```

The active data source is the `DATA_PROVIDER` env var (`manual` default). To work against live data:
`DATA_PROVIDER=football_data FOOTBALL_DATA_API_KEY=key npm run dev`. Copy `.env.example` to `.env`.

## Architecture

Data flows in one direction, normalized to a single shape early:

```
provider (raw source) → normalize → DashboardData → cache → GET /api/dashboard → React client
                                                                                    ↓ every render
                                                              selectDashboardState → DashboardView → UI
```

- **`src/shared/`** is imported by **both** the server and the client, so it must stay
  **dependency-free** (no Express, no React, no Node-only APIs). It holds `types.ts` (the canonical
  data model — `Match`, `Standing`, `BracketNode`, `DashboardData`, `DashboardView`),
  `selectDashboardState.ts`, `time.ts`, and `constants.ts`.

- **`DashboardData` vs `DashboardView`**: `DashboardData` is the raw normalized payload the server
  produces and caches. `DashboardView` is the *derived* view the UI renders (live/today/upcoming
  buckets, hero match, featured group, etc). The view is computed by `selectDashboardState`, which
  the **client recomputes every render against the live clock** (`useNow`) — that's why it lives in
  `shared` and is pure. Don't push time-relative bucketing into the server; it would go stale
  between fetches.

- **Providers** (`src/server/providers/`) implement the `DataProvider` interface
  (`fetchDashboardData()`, optional `invalidate()`). `selectProvider()` picks one from
  `DATA_PROVIDER`. Each provider parses its source into `DashboardData` via the `normalize/`
  modules (`parseOpenFootball`, `parseFootballData`, `normalizeMatch`, `calculateStandings`,
  `applyManualOverrides`). To add a source: write a provider + a `normalize/` parser, register it in
  `providers/index.ts`. Keep all source-specific quirks inside the parser so the rest of the app only
  sees `DashboardData`.

- **Resilience is central** (`dashboardService.ts`): a successful fetch returns fresh data and writes
  `data/cache/dashboard.json` in the background; a provider failure returns the last cache marked
  `stale: true`; with no cache it returns a friendly fallback payload. The API layer never 500s into
  a blank TV. `POST /api/refresh` calls `provider.invalidate()` to force a genuine re-fetch.

- **Timezone** is resolved once in `withTimezone()` for every payload (fresh, cached, or fallback):
  `TIMEZONE` env var wins, then whatever the provider supplied (e.g. `config.json`), else the client
  falls back to `DEFAULT_TIMEZONE`. All `kickoffUtc` values are stored in UTC and rendered in the
  resolved zone.

- **The client is a fixed 1280×720 design canvas** (`App.tsx` / `dashboard.css`). Everything is sized
  in fixed pixels and the whole `.dashboard` is scaled with a CSS transform to fit the real screen, so
  nothing is ever clipped at 720p/1080p. Use fixed px and the `--fs-*` type-scale variables, not
  viewport units. There's also a subtle burn-in nudge (the canvas shifts a few px on a slow cycle).

- **Match accents**: `constants.ts` defines `FAVORITE_TEAMS` (host nations USA/MEX/CAN, highlighted
  via `isFavoriteTeam`) and `HOME_CITY` (Seattle, highlighted via `isHomeCity` on a match's `city`).
  These are UI-only accents (`--favorite`, `--home` color tokens) applied in components — they do
  **not** affect data ordering in `selectDashboardState`, which keeps sorting predictable.

## Conventions / gotchas

- **ESM with explicit `.js` import extensions**, even when importing `.ts` files (e.g.
  `import { x } from './foo.js'`). The server builds under `module: NodeNext` and requires them;
  match the existing style everywhere.
- **Two TypeScript projects**: `tsconfig.json` (client + shared, `moduleResolution: bundler`) and
  `tsconfig.server.json` (server + shared, `NodeNext`). `npm run typecheck` runs both — a change can
  pass one and fail the other.
- `noUnusedLocals` / `noUnusedParameters` are on; prefix intentionally-unused params with `_`.
- **`apps/`** is a directory of self-contained sub-apps that lint and build themselves; root ESLint
  ignores it. Don't assume root tooling covers code under `apps/`.
- Editing `data/manual/*.json`? Run `npm run validate:data` before relying on it.
