import type { DataProvider } from './providerTypes.js';
import { buildDashboardFromRemote } from './remoteSample.js';
import { enrichVenues, loadVenueIndex } from '../normalize/applyVenues.js';

// Stub for a free/open World Cup 2026 REST API (spec §7 Option B). Currently
// reads sample remote-shaped JSON; swap loadRemoteMatches for a real fetch later.
export const worldCupApiProvider: DataProvider = {
  name: 'worldcup_api',
  async fetchDashboardData() {
    const data = await buildDashboardFromRemote('worldcup_api', 'matches.json');
    return { ...data, matches: enrichVenues(data.matches, loadVenueIndex()) };
  },
};
