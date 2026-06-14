// Regenerate data/venues.json — the static stadium+city snapshot the dashboard
// uses to enrich any provider's matches. Source of truth: OpenFootball's 2026
// fixtures (date/time/teams + host *city*) crossed with the host-city -> stadium
// table below. Re-run if the fixtures shift:  npm run generate:venues
import { writeFileSync } from 'node:fs';
import { parseOpenFootball, type OpenFootballFile } from '../src/server/normalize/parseOpenFootball.js';
import type { VenueEntry } from '../src/server/normalize/applyVenues.js';
import { VENUES_FILE } from '../src/server/paths.js';

const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// The 16 host cities (exactly as OpenFootball labels them) -> the WC2026 stadium
// and a clean display city. Common stadium names (not the sponsor-neutral FIFA
// tournament names) since they read better on a kitchen TV.
const STADIUMS: Record<string, { venue: string; city: string }> = {
  Atlanta: { venue: 'Mercedes-Benz Stadium', city: 'Atlanta' },
  'Boston (Foxborough)': { venue: 'Gillette Stadium', city: 'Boston' },
  'Dallas (Arlington)': { venue: 'AT&T Stadium', city: 'Dallas' },
  'Guadalajara (Zapopan)': { venue: 'Estadio Akron', city: 'Guadalajara' },
  Houston: { venue: 'NRG Stadium', city: 'Houston' },
  'Kansas City': { venue: 'Arrowhead Stadium', city: 'Kansas City' },
  'Los Angeles (Inglewood)': { venue: 'SoFi Stadium', city: 'Los Angeles' },
  'Mexico City': { venue: 'Estadio Azteca', city: 'Mexico City' },
  'Miami (Miami Gardens)': { venue: 'Hard Rock Stadium', city: 'Miami' },
  'Monterrey (Guadalupe)': { venue: 'Estadio BBVA', city: 'Monterrey' },
  'New York/New Jersey (East Rutherford)': { venue: 'MetLife Stadium', city: 'New York' },
  Philadelphia: { venue: 'Lincoln Financial Field', city: 'Philadelphia' },
  'San Francisco Bay Area (Santa Clara)': { venue: "Levi's Stadium", city: 'San Francisco' },
  Seattle: { venue: 'Lumen Field', city: 'Seattle' },
  Toronto: { venue: 'BMO Field', city: 'Toronto' },
  Vancouver: { venue: 'BC Place', city: 'Vancouver' },
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
    const stadium = STADIUMS[ground];
    if (!stadium) unmapped.add(ground);
    return {
      kickoffUtc: m.kickoffUtc,
      home: m.homeTeam.id,
      away: m.awayTeam.id,
      stage: m.stage,
      venue: stadium?.venue ?? ground,
      city: stadium?.city ?? ground,
    };
  });
  entries.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

  if (unmapped.size) {
    console.error(`WARNING: no stadium mapping for: ${[...unmapped].join(', ')} — add it to STADIUMS.`);
  }

  writeFileSync(VENUES_FILE, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${entries.length} venue entries to ${VENUES_FILE}`);
}

main().catch((err) => {
  console.error('generate-venues failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
