import type { DataProvider } from './providerTypes.js';
import { buildDashboardFromRemote } from './remoteSample.js';

// Stub for a free/open World Cup 2026 REST API (spec §7 Option B). Currently
// reads sample remote-shaped JSON; swap loadRemoteMatches for a real fetch later.
export const worldCupApiProvider: DataProvider = {
  name: 'worldcup_api',
  fetchDashboardData() {
    return buildDashboardFromRemote('worldcup_api', 'matches.json');
  },
};
