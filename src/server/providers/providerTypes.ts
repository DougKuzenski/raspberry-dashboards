import type { DashboardData } from '../../shared/types.js';

// A data provider knows how to produce a full DashboardData payload from some
// source (manual JSON files, an external API, etc). The server selects one at
// startup via the DATA_PROVIDER env var and can fall back to cache on failure.
export interface DataProvider {
  name: string;
  fetchDashboardData(): Promise<DashboardData>;
  /**
   * Drop any in-memory cache so the next fetchDashboardData() hits the source.
   * Optional — providers without their own cache can omit it. Used by
   * POST /api/refresh to force a genuine refresh.
   */
  invalidate?(): void;
}
