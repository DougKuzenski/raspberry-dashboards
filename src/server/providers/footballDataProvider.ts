import type { DashboardData } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { parseFootballData, type FootballDataResponse } from '../normalize/parseFootballData.js';
import { calculateStandings } from '../normalize/calculateStandings.js';
import { applyManualOverrides } from '../normalize/applyManualOverrides.js';
import { deriveTournamentPhase } from '../../shared/selectDashboardState.js';

// Live provider: football-data.org v4 (free tier). Real status + scores.
// Needs a free API key in FOOTBALL_DATA_API_KEY.
//
// Rate limiting (the maintainer explicitly asks clients to respect it):
//  - A 30s in-memory cache means the kiosk's ~60s polling makes at most ~2 calls/min.
//  - We also read the response's `X-Requests-Available-Minute` / `X-RequestCounter-Reset`
//    headers and back off (serve cached data) until the counter resets when the
//    free 10/min budget is exhausted or we get a 429.
const DEFAULT_BASE = 'https://api.football-data.org';
const COMPETITION = 'WC'; // FIFA World Cup
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

let memo: { at: number; data: DashboardData } | null = null;
let cooldownUntil = 0;

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface FetchResult {
  body: FootballDataResponse;
  remainingMinute: number | null;
  resetSeconds: number | null;
}

async function fetchMatches(base: string, key: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v4/competitions/${COMPETITION}/matches`, {
      signal: controller.signal,
      headers: { 'X-Auth-Token': key },
    });
    const remainingMinute = num(res.headers.get('X-Requests-Available-Minute'));
    const resetSeconds = num(res.headers.get('X-RequestCounter-Reset'));

    if (res.status === 429) {
      // Back off until the counter resets.
      cooldownUntil = Date.now() + ((resetSeconds ?? 60) + 1) * 1000;
      throw new Error('football-data rate limit hit (HTTP 429) — backing off');
    }
    if (res.status === 403) {
      throw new Error('football-data HTTP 403 — key invalid or World Cup not on your plan');
    }
    if (!res.ok) throw new Error(`football-data responded HTTP ${res.status}`);

    return { body: (await res.json()) as FootballDataResponse, remainingMinute, resetSeconds };
  } finally {
    clearTimeout(timer);
  }
}

export const footballDataProvider: DataProvider = {
  name: 'football_data',
  async fetchDashboardData(): Promise<DashboardData> {
    const now = Date.now();

    // Serve the in-memory cache when fresh, or while we're in a backoff window.
    if (memo && now - memo.at < CACHE_TTL_MS) return memo.data;
    if (memo && now < cooldownUntil) return memo.data;

    const key = process.env.FOOTBALL_DATA_API_KEY || process.env.EXTERNAL_API_KEY;
    if (!key) {
      throw new Error('FOOTBALL_DATA_API_KEY is not set — get a free key at football-data.org');
    }
    const base = process.env.FOOTBALL_DATA_BASE_URL || DEFAULT_BASE;

    const { body, remainingMinute, resetSeconds } = await fetchMatches(base, key);

    // Proactively back off if this response exhausted the per-minute budget.
    if (remainingMinute != null && remainingMinute <= 0) {
      cooldownUntil = now + ((resetSeconds ?? 60) + 1) * 1000;
    }

    const matches = parseFootballData(body);
    const standings = calculateStandings(matches);

    let data: DashboardData = {
      generatedAtUtc: new Date().toISOString(),
      tournamentPhase: deriveTournamentPhase(matches),
      matches,
      standings,
      bracket: [],
      source: 'football_data',
    };

    if (process.env.ENABLE_MANUAL_OVERRIDES === 'true') {
      data = await applyManualOverrides(data);
    }

    memo = { at: now, data };
    return data;
  },
};
