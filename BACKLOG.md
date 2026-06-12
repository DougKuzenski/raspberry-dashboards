# Backlog

Future work, captured so we don't re-research it. Nothing here is built yet.

## Live-score provider (real-time scores)

**DONE (2026-06-11):** `football_data` provider wired (football-data.org, free key in
`FOOTBALL_DATA_API_KEY`). Real status + scores + minute + groups + knockout stages, full WC feed —
used standalone (no merge needed). 30s in-memory cache keeps us under the 10/min free limit.
OpenFootball remains the no-key fixtures fallback; manual override still wins over everything.

Remaining ideas below are alternatives only if football-data proves too laggy/limited.

### Candidate sources

| Source | Live? | Cost / auth | Notes |
|---|---|---|---|
| **API-Football** (api-sports.io) | Yes, real-time | Free tier ~100 req/day, API key | Most credible free option. 100/day is enough at a ~5-min poll for the few hours a match is on. Well-documented. World Cup = a `league`/`season` query. |
| **worldcup26.ir** (rezarahiminia/worldcup2026) | Yes (claims) | Free, JWT register/login (token ~84 days) | Single hobbyist `.ir` host — uptime/trust risk. Endpoints: `GET /get/games`, `/get/groups`, `/get/teams`. Stringly-typed fields, Persian dates. Docs: https://worldcup26.ir/api-docs/ |
| football-data.org | Scores, not minute-by-minute | Free 10 req/min, API key | WC included on free tier but no true live / no venues / older format. |
| Sportmonks / TheStatsAPI / LiveScore | Yes | Paid/freemium, key | Bulletproof but costs money. |

**Leaning:** API-Football first (free key, real live), worldcup26.ir as a fallback experiment.

### Implementation sketch

1. New provider `liveScoreProvider.ts` implementing `DataProvider`, OR better: a
   `mergeLiveScores(base: DashboardData, live: LiveMatch[]): DashboardData` step.
2. Match live records to OpenFootball matches by (date + team codes) since ids differ per source.
   May need a team-name/alias map (extend `src/server/providers/teams.ts`).
3. New env: `LIVE_PROVIDER`, `LIVE_API_BASE_URL`, `LIVE_API_KEY`. Keep it optional/off by default.
4. Poll cadence + rate-limit guard (only poll while a match is in its live window) to respect free tiers.
5. Order of precedence: manual override > live source > OpenFootball schedule.

## Other ideas

- Web admin/debug page for editing `data/manual/overrides.json` from a browser (spec §23).
- Provider-based TV-channel mapping (vs. today's manual `tv`/`stream` fields).
- Real on-Pi kiosk validation (Wayland vs X11) once hardware is in hand.
