import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DashboardData } from '../shared/types.js';
import { DEFAULT_TIMEZONE } from '../shared/constants.js';

const REFRESH_MS = 60_000;

// The render timezone for the whole dashboard, supplied once from the payload.
// Components read it via useTimeZone() and pass it to the (pure) time helpers,
// so changing TIMEZONE / config.json actually moves the wall clock.
const TimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);
export const TimeZoneProvider = TimeZoneContext.Provider;
export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}

export interface DashboardFeed {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  /** True once a fetch has failed and we're showing last-known data. */
  stale: boolean;
  lastUpdated: Date | null;
  retry: () => void;
}

export function dashboardFetchErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to load dashboard data';
}

interface DashboardFeedLoadOptions {
  isActive: () => boolean;
  isInFlight: () => boolean;
  setInFlight: (inFlight: boolean) => void;
  setLoading: (loading: boolean) => void;
  setData: (data: DashboardData) => void;
  setError: (error: string | null) => void;
  setStale: (stale: boolean) => void;
  setLastUpdated: (date: Date) => void;
  fetchDashboard?: typeof fetch;
}

export async function loadDashboardFeedOnce({
  isActive,
  isInFlight,
  setInFlight,
  setLoading,
  setData,
  setError,
  setStale,
  setLastUpdated,
  fetchDashboard = fetch,
}: DashboardFeedLoadOptions): Promise<void> {
  if (!isActive() || isInFlight()) return;

  setInFlight(true);
  setLoading(true);

  try {
    const res = await fetchDashboard('/api/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as DashboardData;
    if (!isActive()) return;
    setData(json);
    setError(null);
    setStale(Boolean(json.stale));
    setLastUpdated(new Date());
  } catch (err) {
    if (!isActive()) return;
    setError(dashboardFetchErrorMessage(err));
    setStale(true);
  } finally {
    setInFlight(false);
    if (isActive()) setLoading(false);
  }
}

// Fetch /api/dashboard every 60s. On failure, keep showing the last good data
// and flag it stale rather than blanking the screen (spec §11).
export function useDashboardFeed(): DashboardFeed {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const activeRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(() => {
    void loadDashboardFeedOnce({
      isActive: () => activeRef.current,
      isInFlight: () => inFlightRef.current,
      setInFlight: (inFlight) => {
        inFlightRef.current = inFlight;
      },
      setLoading,
      setData,
      setError,
      setStale,
      setLastUpdated,
    });
  }, []);

  const retry = useCallback(() => {
    load();
  }, [load]);

  useEffect(() => {
    activeRef.current = true;

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      activeRef.current = false;
      clearInterval(id);
    };
  }, [load]);

  return { data, loading, error, stale, lastUpdated, retry };
}

// A clock that re-renders every second, for the header time and live countdowns.
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Scale factor to fit a fixed baseW x baseH design canvas inside the current
// window, preserving aspect ratio (letterboxed). Recomputes on resize so the
// dashboard always shows in full — never clipped — at any resolution or zoom.
export function useFitScale(baseW: number, baseH: number): number {
  const compute = () => Math.min(window.innerWidth / baseW, window.innerHeight / baseH);
  const [scale, setScale] = useState(compute);
  useEffect(() => {
    const onResize = () => setScale(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseW, baseH]);
  return scale;
}
