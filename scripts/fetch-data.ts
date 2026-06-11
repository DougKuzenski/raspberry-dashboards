// Fetch from the active provider once and write the cache file, without running
// the server. Useful for a cron prefetch or to seed the cache. Honors DATA_PROVIDER.
// Usage: DATA_PROVIDER=worldcup_api npm run fetch:data
import { selectProvider } from '../src/server/providers/index.js';
import { writeCache } from '../src/server/cache/writeCache.js';

async function main() {
  const provider = selectProvider();
  console.log(`Fetching dashboard data from provider: ${provider.name}`);
  const data = await provider.fetchDashboardData();
  await writeCache(data);
  console.log(
    `Wrote cache: ${data.matches.length} matches, ${data.standings.length} standings, phase=${data.tournamentPhase}`,
  );
}

main().catch((err) => {
  console.error('fetch-data failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
