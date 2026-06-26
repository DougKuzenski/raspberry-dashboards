import { describe, expect, it } from 'vitest';
import type { Match } from '../src/shared/types.js';
import { matchAccent, matchAccentClassNames, uniqueVenueParts, venueIcon } from '../src/client/components/matchPresentation.js';

const baseMatch: Match = {
  id: 'match-1',
  stage: 'group',
  homeTeam: { id: 'USA', name: 'United States', shortName: 'USA', flagEmoji: '🇺🇸' },
  awayTeam: { id: 'ENG', name: 'England', shortName: 'ENG', flagEmoji: '🏴' },
  kickoffUtc: '2026-06-12T00:00:00Z',
  venue: 'Seattle',
  city: 'Seattle',
  status: 'scheduled',
};

describe('match presentation helpers', () => {
  it('detects favorite teams and home-city matches once for all match rows', () => {
    expect(matchAccent(baseMatch)).toEqual({ favorite: true, home: true });
    expect(matchAccentClassNames('match-row', baseMatch)).toBe('match-row--favorite match-row--home');
  });

  it('deduplicates venue and city labels for focal matches', () => {
    expect(uniqueVenueParts(baseMatch)).toBe('Seattle');
    expect(venueIcon(baseMatch)).toBe('📍');
  });

  it('keeps non-home venue labels distinct', () => {
    const match = { ...baseMatch, venue: 'MetLife Stadium', city: 'New York New Jersey' };

    expect(matchAccent(match)).toEqual({ favorite: true, home: false });
    expect(uniqueVenueParts(match)).toBe('MetLife Stadium, New York New Jersey');
    expect(venueIcon(match)).toBe('🏟');
  });
});
