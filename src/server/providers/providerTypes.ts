import type { DashboardData } from '../../shared/types.js';

// A data provider knows how to produce a full DashboardData payload from some
// source (manual JSON files, an external API, etc). The server selects one at
// startup via the DATA_PROVIDER env var and can fall back to cache on failure.
export interface DataProvider {
  name: string;
  fetchDashboardData(): Promise<DashboardData>;
}
