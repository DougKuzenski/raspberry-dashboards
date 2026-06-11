import type { DashboardData } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { parseOpenFootball, type OpenFootballFile } from '../normalize/parseOpenFootball.js';
import { calculateStandings } from '../normalize/calculateStandings.js';
import { applyManualOverrides } from '../normalize/applyManualOverrides.js';
import { deriveTournamentPhase } from '../../shared/selectDashboardState.js';

// Real provider: OpenFootball public-domain worldcup.json (spec §7 Option A).
// No API key. Static-ish — scores update when the upstream repo is updated during
// the tournament — so it's reliable for fixtures/groups/schedule, with manual
// overrides on top for live channel notes / corrections.
const DEFAULT_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const FETCH_TIMEOUT_MS = 8_000;

async function fetchOpenFootball(url: string): Promise<OpenFootballFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'world-cup-dashboard' },
    });
    if (!res.ok) throw new Error(`OpenFootball responded HTTP ${res.status}`);
    return (await res.json()) as OpenFootballFile;
  } finally {
    clearTimeout(timer);
  }
}

export const openFootballProvider: DataProvider = {
  name: 'openfootball',
  async fetchDashboardData(): Promise<DashboardData> {
    const url = process.env.EXTERNAL_API_BASE_URL || DEFAULT_URL;
    const file = await fetchOpenFootball(url);
    const matches = parseOpenFootball(file);
    const standings = calculateStandings(matches);

    let data: DashboardData = {
      generatedAtUtc: new Date().toISOString(),
      tournamentPhase: deriveTournamentPhase(matches),
      matches,
      standings,
      bracket: [],
      source: 'openfootball',
    };

    if (process.env.ENABLE_MANUAL_OVERRIDES === 'true') {
      data = await applyManualOverrides(data);
    }
    return data;
  },
};
