import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DataProvider } from '../src/server/providers/providerTypes.js';
import { getDashboard } from '../src/server/dashboardService.js';
import * as writeCacheModule from '../src/server/cache/writeCache.js';
import * as providersIndex from '../src/server/providers/index.js';

const ENV_KEYS = ['DATA_PROVIDER', 'TIMEZONE'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getDashboard cache write behavior', () => {
  it('writes cache for fresh provider data', async () => {
    const writeSpy = vi.spyOn(writeCacheModule, 'writeCache').mockResolvedValue(undefined);
    const mockProvider = {
      name: 'mock',
      fetchDashboardData: vi.fn().mockResolvedValue({
        generatedAtUtc: '2026-06-20T20:00:00Z',
        tournamentPhase: 'group',
        matches: [],
        standings: [],
        bracket: [],
        source: 'mock',
      }),
    };
    vi.spyOn(providersIndex, 'selectProvider').mockReturnValue(mockProvider as unknown as DataProvider);

    const result = await getDashboard();
    expect(result.stale).toBeUndefined();
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite disk cache with a stale/cooldown payload', async () => {
    const writeSpy = vi.spyOn(writeCacheModule, 'writeCache').mockResolvedValue(undefined);
    const mockProvider = {
      name: 'mock',
      fetchDashboardData: vi.fn().mockResolvedValue({
        generatedAtUtc: '2026-06-20T19:00:00Z',
        tournamentPhase: 'group',
        matches: [],
        standings: [],
        bracket: [],
        stale: true,
        source: 'mock',
      }),
    };
    vi.spyOn(providersIndex, 'selectProvider').mockReturnValue(mockProvider as unknown as DataProvider);

    const result = await getDashboard();
    expect(result.stale).toBe(true);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
