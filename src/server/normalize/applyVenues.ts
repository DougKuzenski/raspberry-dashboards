import { readFileSync } from 'node:fs';
import type { Match } from '../../shared/types.js';
import { VENUES_FILE } from '../paths.js';

// Enriches normalized matches with stadium + city from a static snapshot
// (data/venues.json), because the live source (football-data.org) carries no
// venue and OpenFootball only carries the host *city*, not the stadium. The 2026
// schedule fixes venue per slot, so a committed snapshot is the boring-reliable
// way to get stadiums without a new API/key.
//
// Matching (proven against the 104-match schedule):
//  - GROUP games -> by (date + team tri-codes). This disambiguates the final
//    round's *simultaneous* matches (same kickoff, different cities), which a
//    time-only key cannot.
//  - KNOCKOUT games -> by exact kickoff minute. Teams are placeholders until
//    decided, but every knockout slot is unique, so the minute identifies it.
//    To stay safe, the minute index holds ONLY unambiguous slots, so a colliding
//    group slot can never resolve to the wrong venue via the time fallback.

export interface VenueEntry {
  kickoffUtc: string;
  home: string; // tri-code (group) or knockout placeholder ("2A")
  away: string;
  stage: string;
  venue: string; // stadium
  city: string;
}

export interface VenueIndex {
  byTeams: Map<string, VenueEntry>;
  byMinute: Map<number, VenueEntry>;
}

function minuteKey(iso: string): number {
  return Math.floor(Date.parse(iso) / 60_000);
}

function teamsKey(iso: string, home: string, away: string): string {
  return `${iso.slice(0, 10)}|${home}|${away}`;
}

export function buildVenueIndex(entries: VenueEntry[]): VenueIndex {
  const minuteCounts = new Map<number, number>();
  for (const e of entries) {
    const mk = minuteKey(e.kickoffUtc);
    minuteCounts.set(mk, (minuteCounts.get(mk) ?? 0) + 1);
  }
  const byTeams = new Map<string, VenueEntry>();
  const byMinute = new Map<number, VenueEntry>();
  for (const e of entries) {
    byTeams.set(teamsKey(e.kickoffUtc, e.home, e.away), e);
    const mk = minuteKey(e.kickoffUtc);
    if (minuteCounts.get(mk) === 1) byMinute.set(mk, e); // unambiguous slots only
  }
  return { byTeams, byMinute };
}

/** Fill venue + city on each match from the snapshot (snapshot wins). */
export function enrichVenues(matches: Match[], index: VenueIndex): Match[] {
  return matches.map((m) => {
    const hit =
      index.byTeams.get(teamsKey(m.kickoffUtc, m.homeTeam.id, m.awayTeam.id)) ??
      index.byMinute.get(minuteKey(m.kickoffUtc));
    return hit ? { ...m, venue: hit.venue, city: hit.city } : m;
  });
}

let cached: VenueIndex | null = null;

/** Load the committed snapshot once. Missing/bad file -> empty (no enrichment). */
export function loadVenueIndex(): VenueIndex {
  if (cached) return cached;
  try {
    const entries = JSON.parse(readFileSync(VENUES_FILE, 'utf8')) as VenueEntry[];
    cached = buildVenueIndex(entries);
  } catch {
    cached = { byTeams: new Map(), byMinute: new Map() };
  }
  return cached;
}
