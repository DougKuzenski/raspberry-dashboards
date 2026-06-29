import type { DashboardData } from '../shared/types.js';
import { selectProvider } from './providers/index.js';
import { readCache } from './cache/readCache.js';
import { writeCache } from './cache/writeCache.js';

// Orchestrates one dashboard load (spec §12 cache behavior):
//   success      -> return fresh data, write cache
//   provider err -> return last cache marked stale
//   no cache     -> return a minimal fallback payload explaining the problem
export interface GetDashboardOptions {
  /** Drop the provider's in-memory cache first, forcing a fresh source fetch. */
  forceRefresh?: boolean;
}

export async function getDashboard(options: GetDashboardOptions = {}): Promise<DashboardData> {
  const provider = selectProvider();
  if (options.forceRefresh) provider.invalidate?.();
  try {
    const data = await provider.fetchDashboardData();
    // Do not overwrite a good disk cache with a stale/cooldown payload.
    if (!data.stale) {
      // Persist last-good in the background; a cache write failure must not break
      // the live response.
      writeCache(data).catch((err) => {
        console.error('[cache] failed to write dashboard cache:', err);
      });
    }
    return withTimezone(data);
  } catch (err) {
    console.error(`[provider:${provider.name}] fetch failed:`, err);
    const cached = await readCache();
    if (cached) {
      return withTimezone({ ...cached, stale: true });
    }
    return withTimezone(fallbackPayload(err));
  }
}

// Resolve the render timezone for every payload (fresh, cached, or fallback) so
// the wall clock is right regardless of provider. Precedence: TIMEZONE env var
// wins (operator override on the Pi), then whatever the provider supplied (e.g.
// config.json for the manual provider). When neither is set the field stays
// undefined and the client falls back to DEFAULT_TIMEZONE.
function withTimezone(data: DashboardData): DashboardData {
  const timezone = process.env.TIMEZONE || data.timezone;
  return timezone ? { ...data, timezone } : data;
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
