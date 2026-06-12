import type { CalendarData } from '../../shared/types.js';

// A provider produces a full CalendarData payload from some source (hand-edited
// JSON, Google calendars via iCal, etc). Selected at startup via CAL_PROVIDER.
export interface CalendarProvider {
  name: string;
  fetchCalendarData(): Promise<CalendarData>;
  /**
   * Drop any in-memory cache so the next fetch hits the source. Optional —
   * providers without their own cache omit it. Used by POST /api/refresh.
   */
  invalidate?(): void;
}
