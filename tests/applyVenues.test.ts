import { describe, it, expect } from 'vitest';
import { buildVenueIndex, enrichVenues, loadVenueIndex, type VenueEntry } from '../src/server/normalize/applyVenues.js';
import type { Match } from '../src/shared/types.js';

function match(over: Partial<Match> & Pick<Match, 'kickoffUtc'>): Match {
  return {
    id: 'm', stage: 'group', homeTeam: { id: 'AAA', name: 'A' }, awayTeam: { id: 'BBB', name: 'B' },
    status: 'scheduled', ...over,
  };
}

// Two simultaneous group games (final round) + one knockout with placeholder teams.
const ENTRIES: VenueEntry[] = [
  { kickoffUtc: '2026-06-24T18:00:00.000Z', home: 'USA', away: 'MEX', stage: 'group', venue: 'SoFi Stadium', city: 'Los Angeles' },
  { kickoffUtc: '2026-06-24T18:00:00.000Z', home: 'CAN', away: 'BRA', stage: 'group', venue: 'Lumen Field', city: 'Seattle' },
  { kickoffUtc: '2026-06-28T19:00:00.000Z', home: '2A', away: '2B', stage: 'round_of_32', venue: 'AT&T Stadium', city: 'Dallas' },
];

describe('enrichVenues', () => {
  const index = buildVenueIndex(ENTRIES);

  it('fills group venues by team codes, disambiguating simultaneous kickoffs', () => {
    const [a, b] = enrichVenues(
      [
        match({ kickoffUtc: '2026-06-24T18:00:00.000Z', homeTeam: { id: 'USA', name: 'USA' }, awayTeam: { id: 'MEX', name: 'Mexico' } }),
        match({ kickoffUtc: '2026-06-24T18:00:00.000Z', homeTeam: { id: 'CAN', name: 'Canada' }, awayTeam: { id: 'BRA', name: 'Brazil' } }),
      ],
      index,
    );
    expect(a.venue).toBe('SoFi Stadium');
    expect(a.city).toBe('Los Angeles');
    expect(b.venue).toBe('Lumen Field'); // same minute, different venue — resolved correctly
  });

  it('fills knockout venues by kickoff time even though the snapshot teams are placeholders', () => {
    const [m] = enrichVenues(
      [match({ kickoffUtc: '2026-06-28T19:00:00.000Z', stage: 'round_of_32', homeTeam: { id: 'NED', name: 'Netherlands' }, awayTeam: { id: 'JPN', name: 'Japan' } })],
      index,
    );
    expect(m.venue).toBe('AT&T Stadium');
    expect(m.city).toBe('Dallas');
  });

  it('never resolves a colliding slot by time alone (no wrong venue)', () => {
    // Unknown teams at the simultaneous 18:00 slot: teams-key misses and the
    // minute is ambiguous, so it must stay blank rather than guess.
    const [m] = enrichVenues(
      [match({ kickoffUtc: '2026-06-24T18:00:00.000Z', homeTeam: { id: 'XXX', name: 'X' }, awayTeam: { id: 'YYY', name: 'Y' } })],
      index,
    );
    expect(m.venue).toBeUndefined();
  });

  it('overrides an existing (city-only) venue from the snapshot', () => {
    const [m] = enrichVenues(
      [match({ kickoffUtc: '2026-06-24T18:00:00.000Z', homeTeam: { id: 'USA', name: 'USA' }, awayTeam: { id: 'MEX', name: 'Mexico' }, venue: 'Los Angeles', city: 'Los Angeles' })],
      index,
    );
    expect(m.venue).toBe('SoFi Stadium');
  });

  it('leaves unknown matches untouched', () => {
    const [m] = enrichVenues([match({ kickoffUtc: '2030-01-01T00:00:00.000Z' })], index);
    expect(m.venue).toBeUndefined();
  });
});

describe('committed snapshot (data/venues.json)', () => {
  const index = loadVenueIndex();

  it('enriches the real opener (MEX v RSA) with stadium + city', () => {
    const [m] = enrichVenues(
      [match({ kickoffUtc: '2026-06-11T19:00:00.000Z', homeTeam: { id: 'MEX', name: 'Mexico' }, awayTeam: { id: 'RSA', name: 'South Africa' } })],
      index,
    );
    expect(m.venue).toBe('Estadio Azteca');
    expect(m.city).toBe('Mexico City');
  });

  it('has all 104 matches indexed by teams', () => {
    expect(index.byTeams.size).toBe(104);
  });
});
