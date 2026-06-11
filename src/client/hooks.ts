import { useEffect, useState } from 'react';
import type { DashboardData } from '../shared/types.js';

const REFRESH_MS = 60_000;

export interface DashboardFeed {
  data: DashboardData | null;
  /** True once a fetch has failed and we're showing last-known data. */
  stale: boolean;
  lastUpdated: Date | null;
}

// Fetch /api/dashboard every 60s. On failure, keep showing the last good data
// and flag it stale rather than blanking the screen (spec §11).
export function useDashboardFeed(): DashboardFeed {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DashboardData;
        if (cancelled) return;
        setData(json);
        setStale(Boolean(json.stale));
        setLastUpdated(new Date());
      } catch {
        if (!cancelled) setStale(true);
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, stale, lastUpdated };
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
