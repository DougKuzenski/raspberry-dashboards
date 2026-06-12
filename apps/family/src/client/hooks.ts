import { createContext, useContext, useEffect, useState } from 'react';
import type { CalendarData } from '../shared/types.js';
import { DEFAULT_TIMEZONE } from '../shared/constants.js';

const REFRESH_MS = 60_000;

// Render timezone for the whole board, supplied from the payload.
const TimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);
export const TimeZoneProvider = TimeZoneContext.Provider;
export function useTimeZone(): string {
  return useContext(TimeZoneContext);
}

export interface CalendarFeed {
  data: CalendarData | null;
  stale: boolean;
  lastUpdated: Date | null;
}

// Fetch /api/dashboard every 60s. On failure, keep showing the last good data
// and flag it stale rather than blanking the screen.
export function useCalendarFeed(): CalendarFeed {
  const [data, setData] = useState<CalendarData | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CalendarData;
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

// A clock that re-renders every second, for the header time and "now/next".
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Scale a fixed design canvas to fit the window, preserving aspect (letterboxed).
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
