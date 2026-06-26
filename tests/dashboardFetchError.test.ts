import { describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../src/shared/types.js';
import { dashboardFetchErrorMessage, loadDashboardFeedOnce } from '../src/client/hooks.js';

describe('dashboardFetchErrorMessage', () => {
  it('preserves concrete HTTP status messages', () => {
    expect(dashboardFetchErrorMessage(new Error('HTTP 404'))).toBe('HTTP 404');
  });

  it('falls back for non-Error failures', () => {
    expect(dashboardFetchErrorMessage('network down')).toBe('Unable to load dashboard data');
  });
});

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    generatedAtUtc: '2026-06-26T00:00:00.000Z',
    tournamentPhase: 'group',
    matches: [],
    standings: [],
    bracket: [],
    ...overrides,
  };
}

function response(status: number, body?: DashboardData): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function createHarness(fetchDashboard: ReturnType<typeof vi.fn>) {
  const state: {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
    stale: boolean;
    lastUpdated: Date | null;
    active: boolean;
    inFlight: boolean;
  } = {
    data: null,
    loading: false,
    error: null,
    stale: false,
    lastUpdated: null,
    active: true,
    inFlight: false,
  };

  const load = () =>
    loadDashboardFeedOnce({
      isActive: () => state.active,
      isInFlight: () => state.inFlight,
      setInFlight: (inFlight) => {
        state.inFlight = inFlight;
      },
      setLoading: (loading) => {
        state.loading = loading;
      },
      setData: (data) => {
        state.data = data;
      },
      setError: (error) => {
        state.error = error;
      },
      setStale: (stale) => {
        state.stale = stale;
      },
      setLastUpdated: (date) => {
        state.lastUpdated = date;
      },
      fetchDashboard: fetchDashboard as typeof fetch,
    });

  return { state, load };
}

describe('loadDashboardFeedOnce', () => {
  it('sets an error and keeps data null when the first load fails', async () => {
    const fetchDashboard = vi.fn().mockResolvedValue(response(404));
    const { state, load } = createHarness(fetchDashboard);

    await load();

    expect(state.data).toBeNull();
    expect(state.error).toBe('HTTP 404');
    expect(state.stale).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('retains data and marks stale when a later poll fails', async () => {
    const firstPayload = dashboardData();
    const fetchDashboard = vi
      .fn()
      .mockResolvedValueOnce(response(200, firstPayload))
      .mockResolvedValueOnce(response(500));
    const { state, load } = createHarness(fetchDashboard);

    await load();
    await load();

    expect(state.data).toBe(firstPayload);
    expect(state.error).toBe('HTTP 500');
    expect(state.stale).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('clears a previous error after a successful load', async () => {
    const secondPayload = dashboardData({ source: 'manual' });
    const fetchDashboard = vi
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, secondPayload));
    const { state, load } = createHarness(fetchDashboard);

    await load();
    await load();

    expect(state.data).toBe(secondPayload);
    expect(state.error).toBeNull();
    expect(state.stale).toBe(false);
    expect(state.lastUpdated).toBeInstanceOf(Date);
  });

  it('does not start a second fetch while one is already in flight', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchDashboard = vi.fn().mockReturnValue(pendingFetch);
    const { state, load } = createHarness(fetchDashboard);

    const firstLoad = load();
    const secondLoad = load();

    expect(fetchDashboard).toHaveBeenCalledTimes(1);
    expect(state.loading).toBe(true);

    const payload = dashboardData();
    resolveFetch(response(200, payload));
    await Promise.all([firstLoad, secondLoad]);

    expect(state.data).toBe(payload);
    expect(state.inFlight).toBe(false);
    expect(state.loading).toBe(false);
  });

  it('does not write feed state after the component is inactive', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchDashboard = vi.fn().mockReturnValue(pendingFetch);
    const { state, load } = createHarness(fetchDashboard);

    const pendingLoad = load();
    state.active = false;
    resolveFetch(response(200, dashboardData()));
    await pendingLoad;

    expect(state.data).toBeNull();
    expect(state.error).toBeNull();
    expect(state.stale).toBe(false);
    expect(state.inFlight).toBe(false);
  });
});
