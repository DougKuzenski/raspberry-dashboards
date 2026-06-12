import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { icalProvider } from '../src/server/providers/icalProvider.js';

const GOOD_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:ok-1',
  'SUMMARY:Family thing',
  `DTSTART:${icsStamp(Date.now() + 3600_000)}`,
  `DTEND:${icsStamp(Date.now() + 7200_000)}`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

const SOURCES = JSON.stringify([
  { id: 'family', label: 'Family', color: '#2dd4bf', url: 'https://example.test/family.ics' },
  { id: 'school', label: 'School', color: '#f59e0b', url: 'https://example.test/school.ics' },
]);

describe('icalProvider partial failure', () => {
  beforeEach(() => {
    process.env.ICAL_SOURCES = SOURCES;
    icalProvider.invalidate?.();
  });
  afterEach(() => {
    delete process.env.ICAL_SOURCES;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('marks the payload degraded and flags the failed source, keeping the good one', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('family')) {
        return { ok: true, text: async () => GOOD_ICS } as unknown as Response;
      }
      throw new Error('connection refused');
    }));

    const data = await icalProvider.fetchDashboardData();
    expect(data.degraded).toBe(true);
    expect(data.sources.find((s) => s.id === 'school')?.failed).toBe(true);
    expect(data.sources.find((s) => s.id === 'family')?.failed).toBeUndefined();
    expect(data.events.some((e) => e.source === 'family')).toBe(true);
  });

  it('throws (so the cache fallback engages) only when every source fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    await expect(icalProvider.fetchDashboardData()).rejects.toThrow(/All iCal sources failed/);
  });

  it('produces a complete, non-degraded payload when all sources load', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => GOOD_ICS } as unknown as Response)));
    const data = await icalProvider.fetchDashboardData();
    expect(data.degraded).toBeUndefined();
    expect(data.sources.every((s) => !s.failed)).toBe(true);
  });
});
