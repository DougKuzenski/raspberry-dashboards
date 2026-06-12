import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openFootballProvider } from '../src/server/providers/openFootballProvider.js';
import type { OpenFootballFile } from '../src/server/normalize/parseOpenFootball.js';

const FILE: OpenFootballFile = {
  name: 'World Cup 2026',
  matches: [
    {
      round: 'Group A',
      date: '2026-06-11',
      time: '11:05 UTC',
      group: 'Group A',
      team1: 'Mexico',
      team2: 'Canada',
      ground: 'Estadio Azteca',
    },
  ],
};

function mockFetch() {
  return vi.fn(async () => ({ ok: true, json: async () => FILE }) as unknown as Response);
}

describe('openFootballProvider caching', () => {
  beforeEach(() => {
    openFootballProvider.invalidate?.();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads the fixtures file once within the TTL but re-infers status each call', async () => {
    const fetchSpy = mockFetch();
    vi.stubGlobal('fetch', fetchSpy);

    // Before kickoff (11:05Z) -> scheduled.
    vi.setSystemTime(new Date('2026-06-11T11:00:00Z'));
    const before = await openFootballProvider.fetchDashboardData();
    expect(before.matches[0].status).toBe('scheduled');

    // 10 min later, past kickoff but inside the TTL -> live, without re-fetching.
    vi.setSystemTime(new Date('2026-06-11T11:10:00Z'));
    const after = await openFootballProvider.fetchDashboardData();
    expect(after.matches[0].status).toBe('live');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-downloads after invalidate()', async () => {
    const fetchSpy = mockFetch();
    vi.stubGlobal('fetch', fetchSpy);
    vi.setSystemTime(new Date('2026-06-11T11:00:00Z'));

    await openFootballProvider.fetchDashboardData();
    openFootballProvider.invalidate?.();
    await openFootballProvider.fetchDashboardData();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
