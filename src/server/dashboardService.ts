import type { DashboardData } from '../shared/types.js';
import { selectProvider } from './providers/index.js';
import { readCache } from './cache/readCache.js';
import { writeCache } from './cache/writeCache.js';

// Orchestrates one dashboard load (spec §12 cache behavior):
//   success      -> return fresh data, write cache
//   provider err -> return last cache marked stale
//   no cache     -> return a minimal fallback payload explaining the problem
export async function getDashboard(): Promise<DashboardData> {
  const provider = selectProvider();
  try {
    const data = await provider.fetchDashboardData();
    // Persist last-good in the background; a cache write failure must not break
    // the live response.
    writeCache(data).catch((err) => {
      console.error('[cache] failed to write dashboard cache:', err);
    });
    return data;
  } catch (err) {
    console.error(`[provider:${provider.name}] fetch failed:`, err);
    const cached = await readCache();
    if (cached) {
      return { ...cached, stale: true };
    }
    return fallbackPayload(err);
  }
}

function fallbackPayload(err: unknown): DashboardData {
  const reason = err instanceof Error ? err.message : String(err);
  return {
    generatedAtUtc: new Date().toISOString(),
    tournamentPhase: 'group',
    matches: [],
    standings: [],
    bracket: [],
    stale: true,
    source: 'fallback',
    manualMessage: `Dashboard data is temporarily unavailable (${reason}). Showing fallback screen.`,
  };
}
