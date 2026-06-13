import type { CalendarData } from '../shared/types.js';
import { DEFAULT_TIMEZONE } from '../shared/constants.js';
import { selectProvider } from './providers/index.js';
import { readCache } from './cache/readCache.js';
import { writeCache } from './cache/writeCache.js';

export interface GetDashboardOptions {
  /** Drop the provider's in-memory cache first, forcing a fresh source fetch. */
  forceRefresh?: boolean;
}

// Orchestrates one load:
//   success      -> return fresh data, write cache (unless degraded)
//   provider err -> return last cache marked stale
//   no cache     -> minimal fallback payload explaining the problem
export async function getDashboard(options: GetDashboardOptions = {}): Promise<CalendarData> {
  const provider = selectProvider();
  if (options.forceRefresh) provider.invalidate?.();
  try {
    const data = await provider.fetchDashboardData();
    // A degraded payload (some sources failed) is served but must never become
    // "last good" — otherwise a later total failure falls back to partial data.
    if (!data.degraded) {
      writeCache(data).catch((err) => console.error('[cache] failed to write calendar cache:', err));
    }
    return withTimezone(data);
  } catch (err) {
    console.error(`[provider:${provider.name}] fetch failed:`, err);
    const cached = await readCache();
    if (cached) return withTimezone({ ...cached, stale: true });
    return withTimezone(fallbackPayload(err));
  }
}

// TIMEZONE env wins over whatever the provider supplied; otherwise leave as-is.
function withTimezone(data: CalendarData): CalendarData {
  const timezone = process.env.TIMEZONE || data.timezone;
  return timezone ? { ...data, timezone } : data;
}

function fallbackPayload(err: unknown): CalendarData {
  const reason = err instanceof Error ? err.message : String(err);
  return {
    generatedAtUtc: new Date().toISOString(),
    timezone: process.env.TIMEZONE || DEFAULT_TIMEZONE,
    sources: [],
    events: [],
    stale: true,
    source: 'fallback',
    manualMessage: `Calendar data is temporarily unavailable (${reason}).`,
  };
}
