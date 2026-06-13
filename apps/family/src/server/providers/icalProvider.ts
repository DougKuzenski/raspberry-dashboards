import type { CalEvent, CalendarData } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { parseIcs } from '../normalize/parseIcs.js';
import { AGENDA_DAYS, DEFAULT_TIMEZONE } from '../../shared/constants.js';

// Live provider: Google calendars via their **secret iCal URLs** (Settings ->
// "Secret address in iCal format"). No OAuth, no token refresh — just HTTP GETs
// of .ics files, which is the reliable shape for an unattended kiosk. Fan out
// over the configured sources, parse + merge, and tag each event with its source.
//
// Config (JSON in env ICAL_SOURCES):
//   [{"id":"family","label":"Family","color":"#2dd4bf","url":"https://calendar.google.com/calendar/ical/.../basic.ics"}, ...]
const TTL_MS = 15 * 60_000; // calendars change slowly; throttle the network
const RETRY_TTL_MS = 60_000; // a degraded payload retries the failed source soon
const FETCH_TIMEOUT_MS = 10_000;
const DAY_MS = 86_400_000;

interface IcalSourceConfig {
  id: string;
  label: string;
  color: string;
  url: string;
}

let memo: { at: number; ttl: number; data: CalendarData } | null = null;

function readSources(): IcalSourceConfig[] {
  const raw = process.env.ICAL_SOURCES;
  if (!raw) throw new Error('ICAL_SOURCES is not set — provide a JSON array of {id,label,color,url}.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`ICAL_SOURCES is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('ICAL_SOURCES must be a non-empty array.');
  return parsed.map((s, i) => {
    const o = s as Record<string, unknown>;
    for (const k of ['id', 'label', 'color', 'url']) {
      if (typeof o[k] !== 'string') throw new Error(`ICAL_SOURCES[${i}].${k} must be a string.`);
    }
    return o as unknown as IcalSourceConfig;
  });
}

async function fetchIcs(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'family-dashboard' } });
    if (!res.ok) throw new Error(`iCal source responded HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export const icalProvider: DataProvider = {
  name: 'ical',
  invalidate(): void {
    memo = null;
  },
  async fetchDashboardData(): Promise<CalendarData> {
    const now = Date.now();
    if (memo && now - memo.at < memo.ttl) return memo.data;

    const tz = process.env.TIMEZONE || DEFAULT_TIMEZONE;
    const configs = readSources();
    const windowStartMs = now - 12 * 3600_000; // small past buffer for in-progress events
    const windowEndMs = now + (AGENDA_DAYS + 1) * DAY_MS;

    const events: CalEvent[] = [];
    // Fetch sources concurrently; one bad calendar shouldn't sink the rest — but
    // a partial result must be *visible*, not silently passed off as complete.
    const failed = new Set<string>();
    const results = await Promise.allSettled(
      configs.map(async (c) => {
        const text = await fetchIcs(c.url);
        return parseIcs(text, { sourceId: c.id, windowStartMs, windowEndMs, defaultTz: tz });
      }),
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') events.push(...r.value);
      else {
        failed.add(configs[i].id);
        console.error(`[ical] source "${configs[i].id}" failed:`, r.reason);
      }
    });
    if (failed.size === configs.length) {
      throw new Error('All iCal sources failed to load.');
    }

    const degraded = failed.size > 0;
    const data: CalendarData = {
      generatedAtUtc: new Date().toISOString(),
      timezone: tz,
      sources: configs.map(({ id, label, color }) => ({
        id,
        label,
        color,
        ...(failed.has(id) ? { failed: true } : {}),
      })),
      events,
      ...(degraded ? { degraded: true } : {}),
      source: 'ical',
    };
    // Serve a degraded payload (better than blank) but memoize it only briefly
    // so the failed calendar gets retried soon instead of looking empty for 15m.
    memo = { at: now, ttl: degraded ? RETRY_TTL_MS : TTL_MS, data };
    return data;
  },
};
