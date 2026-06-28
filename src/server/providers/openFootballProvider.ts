import type { DashboardData } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { parseOpenFootball, type OpenFootballFile } from '../normalize/parseOpenFootball.js';
import { calculateStandings } from '../normalize/calculateStandings.js';
import { buildKnockoutSkeleton, mergeKnockoutFixtures } from '../normalize/buildBracket.js';
import { enrichVenues, loadVenueIndex } from '../normalize/applyVenues.js';
import { applyManualOverrides } from '../normalize/applyManualOverrides.js';
import { deriveTournamentPhase } from '../../shared/selectDashboardState.js';

// Real provider: OpenFootball public-domain worldcup.json (spec §7 Option A).
// No API key. Static-ish — scores update when the upstream repo is updated during
// the tournament — so it's reliable for fixtures/groups/schedule, with manual
// overrides on top for live channel notes / corrections.
const DEFAULT_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const FETCH_TIMEOUT_MS = 8_000;

// The fixtures file is hand-maintained (~monthly) — there's no reason to re-pull
// the full ~104-match document every ~60s of kiosk polling. Cache the raw fetch
// for 15 min as a network throttle, but always re-derive matches/standings below
// so kickoff-inferred status (scheduled -> live -> finished) stays fresh on every
// request even while the download is cached.
const RAW_TTL_MS = 15 * 60_000;
let rawMemo: { at: number; file: OpenFootballFile } | null = null;

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

async function getFile(url: string): Promise<OpenFootballFile> {
  const now = Date.now();
  if (rawMemo && now - rawMemo.at < RAW_TTL_MS) return rawMemo.file;
  const file = await fetchOpenFootball(url);
  rawMemo = { at: now, file };
  return file;
}

export const openFootballProvider: DataProvider = {
  name: 'openfootball',
  // Drop the cached fixtures file so a forced refresh re-downloads it.
  invalidate(): void {
    rawMemo = null;
  },
  async fetchDashboardData(): Promise<DashboardData> {
    const url = process.env.EXTERNAL_API_BASE_URL || DEFAULT_URL;
    const file = await getFile(url);
    const matches = enrichVenues(parseOpenFootball(file), loadVenueIndex());
    const standings = calculateStandings(matches);

    let data: DashboardData = {
      generatedAtUtc: new Date().toISOString(),
      tournamentPhase: deriveTournamentPhase(matches),
      matches,
      standings,
      bracket: mergeKnockoutFixtures(buildKnockoutSkeleton(), matches),
      source: 'openfootball',
    };

    if (process.env.ENABLE_MANUAL_OVERRIDES === 'true') {
      data = await applyManualOverrides(data);
    }
    return data;
  },
};
