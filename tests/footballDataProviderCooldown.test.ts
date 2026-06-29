import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { footballDataProvider } from '../src/server/providers/footballDataProvider.js';

const ENV_KEYS = ['FOOTBALL_DATA_API_KEY', 'EXTERNAL_API_KEY', 'FOOTBALL_DATA_BASE_URL'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

function makeResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: async () => body,
  } as Response;
}

const validBody = {
  matches: [
    {
      id: 1,
      utcDate: '2026-06-20T20:00:00Z',
      status: 'FINISHED',
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      homeTeam: { id: 1, name: 'Brazil', tla: 'BRA' },
      awayTeam: { id: 2, name: 'Japan', tla: 'JPN' },
      score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM', duration: 'REGULAR' },
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-20T21:00:00Z'));
  footballDataProvider.invalidate();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  process.env.FOOTBALL_DATA_API_KEY = 'test-key';
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('footballDataProvider rate-limit cooldown', () => {
  it('returns memo data flagged stale while in cooldown', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    // 1) Success — populate memo.
    fetchMock.mockResolvedValueOnce(
      makeResponse(200, validBody, {
        'X-Requests-Available-Minute': '10',
        'X-RequestCounter-Reset': '60',
      }),
    );
    const first = await footballDataProvider.fetchDashboardData();
    expect(first.stale).toBeUndefined();
    expect(first.matches).toHaveLength(1);

    // Advance past TTL so the next call reaches the network.
    vi.advanceTimersByTime(31 * 60 * 1000);

    // 2) 429 — enter cooldown.
    fetchMock.mockResolvedValueOnce(
      makeResponse(429, {}, {
        'X-RequestCounter-Reset': '3600',
      }),
    );
    await expect(footballDataProvider.fetchDashboardData()).rejects.toThrow('rate limit');

    // 3) During cooldown — return stale memo without hitting the network.
    fetchMock.mockClear();
    const cooldownResult = await footballDataProvider.fetchDashboardData();
    expect(cooldownResult.stale).toBe(true);
    expect(cooldownResult.matches).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance past cooldown so subsequent tests are not affected.
    vi.advanceTimersByTime((3600 + 2) * 1000);
  });

  it('does not mark stale when serving within normal TTL', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      makeResponse(200, validBody, {
        'X-Requests-Available-Minute': '10',
        'X-RequestCounter-Reset': '60',
      }),
    );
    const first = await footballDataProvider.fetchDashboardData();
    expect(first.stale).toBeUndefined();

    // Immediately request again — still inside TTL.
    fetchMock.mockClear();
    const second = await footballDataProvider.fetchDashboardData();
    expect(second.stale).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
