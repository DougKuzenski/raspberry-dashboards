import type { DataProvider } from './providerTypes.js';
import { buildDashboardFromRemote } from './remoteSample.js';

// Stub for OpenFootball public-domain JSON (spec §7 Option A). Good for static
// fixtures/groups; here it reads the same sample remote shape for now.
export const openFootballProvider: DataProvider = {
  name: 'openfootball',
  fetchDashboardData() {
    return buildDashboardFromRemote('openfootball', 'matches.json');
  },
};
