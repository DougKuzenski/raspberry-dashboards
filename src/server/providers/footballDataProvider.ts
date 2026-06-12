import type { DashboardData } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { parseFootballData, type FootballDataResponse } from '../normalize/parseFootballData.js';
import { calculateStandings } from '../normalize/calculateStandings.js';
import { applyManualOverrides } from '../normalize/applyManualOverrides.js';
import { deriveTournamentPhase } from '../../shared/selectDashboardState.js';

// Live provider: football-data.org v4 (spec §7 Option C, free tier).
// Real status + scores. Needs a free API key in FOOTBALL_DATA_API_KEY.
//
// Free tier is 10 requests/minute. The client polls /api/dashboard every ~60s
// (1 req/min), but we add a short in-memory cache so bursts/multiple clients
// can't push us over the limit, and we don't re-fetch needlessly.
const DEFAULT_BASE = 'https://api.football-data.org';
const COMPETITION = 'WC'; // FIFA World Cup
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30_000;

let memo: { at: number; data: DashboardData } | null = null;

async function fetchMatches(base: string, key: string): Promise<FootballDataResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v4/competitions/${COMPETITION}/matches`, {
      signal: controller.signal,
      headers: { 'X-Auth-Token': key },
    });
    if (res.status === 429) throw new Error('football-data rate limit hit (HTTP 429)');
    if (res.status === 403) {
      throw new Error('football-data HTTP 403 — key invalid or World Cup not on your plan');
    }
    if (!res.ok) throw new Error(`football-data responded HTTP ${res.status}`);
    return (await res.json()) as FootballDataResponse;
  } finally {
    clearTimeout(timer);
  }
}

export const footballDataProvider: DataProvider = {
  name: 'football_data',
  async fetchDashboardData(): Promise<DashboardData> {
    if (memo && Date.now() - memo.at < CACHE_TTL_MS) return memo.data;

    const key = process.env.FOOTBALL_DATA_API_KEY || process.env.EXTERNAL_API_KEY;
    if (!key) {
      throw new Error('FOOTBALL_DATA_API_KEY is not set — get a free key at football-data.org');
    }
    const base = process.env.FOOTBALL_DATA_BASE_URL || DEFAULT_BASE;

    const response = await fetchMatches(base, key);
    const matches = parseFootballData(response);
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

    memo = { at: Date.now(), data };
    return data;
  },
};
