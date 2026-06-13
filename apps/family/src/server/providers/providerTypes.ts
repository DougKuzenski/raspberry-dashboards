import type { CalendarData } from '../../shared/types.js';

// A data provider produces a full CalendarData payload from some source
// (hand-edited JSON, Google calendars via iCal, etc). Selected at startup via
// CAL_PROVIDER. (Named to match the World Cup app's interface — identical
// semantics keep the future shared-runtime diff clean.)
export interface DataProvider {
  name: string;
  fetchDashboardData(): Promise<CalendarData>;
  /**
   * Drop any in-memory cache so the next fetch hits the source. Optional —
   * providers without their own cache omit it. Used by POST /api/refresh.
   */
  invalidate?(): void;
}
