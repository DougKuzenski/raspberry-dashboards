import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDashboard } from '../src/server/dashboardService.js';
import { footballDataProvider } from '../src/server/providers/footballDataProvider.js';

// Save/restore only the env vars these tests touch, so we don't clobber the
// special process.env object.
const ENV_KEYS = ['DATA_PROVIDER', 'TIMEZONE', 'FOOTBALL_DATA_API_KEY', 'EXTERNAL_API_KEY'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe('getDashboard timezone resolution', () => {
  it('uses the manual provider config timezone by default', async () => {
    process.env.DATA_PROVIDER = 'manual';
    delete process.env.TIMEZONE;
    const data = await getDashboard();
    expect(data.timezone).toBe('America/Los_Angeles');
  });

  it('lets the TIMEZONE env var override the provider timezone', async () => {
    process.env.DATA_PROVIDER = 'manual';
    process.env.TIMEZONE = 'America/New_York';
    const data = await getDashboard();
    expect(data.timezone).toBe('America/New_York');
  });
});

describe('getDashboard force refresh', () => {
  it('invalidates the provider cache only when forceRefresh is set', async () => {
    process.env.DATA_PROVIDER = 'football_data';
    delete process.env.FOOTBALL_DATA_API_KEY;
    delete process.env.EXTERNAL_API_KEY;
    const spy = vi.spyOn(footballDataProvider, 'invalidate');

    // A normal load leaves the provider's in-memory cache alone.
    await getDashboard();
    expect(spy).not.toHaveBeenCalled();

    // A forced refresh drops it first (here the keyless fetch then falls back to
    // cache, but the invalidate must still have fired).
    await getDashboard({ forceRefresh: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
