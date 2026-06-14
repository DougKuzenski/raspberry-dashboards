// Regenerate data/venues.json — the static city snapshot the dashboard uses to
// enrich any provider's matches. Source of truth: OpenFootball's 2026 fixtures
// (date/time/teams + host city) tidied through the table below into clean,
// across-the-room-readable city names. Re-run if the fixtures shift:
//   npm run generate:venues
// (We show city names, not stadiums — simpler to read on the kitchen TV.)
import { writeFileSync } from 'node:fs';
import { parseOpenFootball, type OpenFootballFile } from '../src/server/normalize/parseOpenFootball.js';
import type { VenueEntry } from '../src/server/normalize/applyVenues.js';
import { VENUES_FILE } from '../src/server/paths.js';

const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// The 16 host cities, exactly as OpenFootball labels them -> a clean display
// city (mostly just dropping the parenthetical suburb). "Seattle" must stay
// "Seattle" for the home-city accent (constants.HOME_CITY).
const CITIES: Record<string, string> = {
  Atlanta: 'Atlanta',
  'Boston (Foxborough)': 'Boston',
  'Dallas (Arlington)': 'Dallas',
  'Guadalajara (Zapopan)': 'Guadalajara',
  Houston: 'Houston',
  'Kansas City': 'Kansas City',
  'Los Angeles (Inglewood)': 'Los Angeles',
  'Mexico City': 'Mexico City',
  'Miami (Miami Gardens)': 'Miami',
  'Monterrey (Guadalupe)': 'Monterrey',
  'New York/New Jersey (East Rutherford)': 'New York',
  Philadelphia: 'Philadelphia',
  'San Francisco Bay Area (Santa Clara)': 'San Francisco',
  Seattle: 'Seattle',
  Toronto: 'Toronto',
  Vancouver: 'Vancouver',
};

async function main() {
  const url = process.env.EXTERNAL_API_BASE_URL || OPENFOOTBALL_URL;
  console.log(`Fetching fixtures: ${url}`);
  const res = await fetch(url, { headers: { 'user-agent': 'world-cup-dashboard' } });
  if (!res.ok) throw new Error(`OpenFootball responded HTTP ${res.status}`);
  const file = (await res.json()) as OpenFootballFile;

  const matches = parseOpenFootball(file);
  const unmapped = new Set<string>();
  const entries: VenueEntry[] = matches.map((m) => {
    // parseOpenFootball put the host city into `city` (== OpenFootball `ground`).
    const ground = m.city ?? '';
    const city = CITIES[ground];
    if (!city) unmapped.add(ground);
    const clean = city ?? ground;
    // venue == city: we display city names, but keep both fields populated so the
    // row components (which read `venue`) and the home-city accent (which reads
    // `city`) both work.
    return { kickoffUtc: m.kickoffUtc, home: m.homeTeam.id, away: m.awayTeam.id, stage: m.stage, venue: clean, city: clean };
  });
  entries.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  if (unmapped.size) {
    console.error(`WARNING: no city mapping for: ${[...unmapped].join(', ')} — add it to CITIES.`);
  }

  writeFileSync(VENUES_FILE, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} venue entries to ${VENUES_FILE}`);
}

main().catch((err) => {
  console.error('generate-venues failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
