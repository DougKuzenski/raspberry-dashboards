import { describe, expect, it } from 'vitest';
import type { Match } from '../src/shared/types.js';
import {
  COMFORTABLE_ROW_LIMIT,
  matchAccent,
  matchAccentClassNames,
  matchListDensity,
  venueIcon,
} from '../src/client/components/matchPresentation.js';

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

  it('flags the home-city venue icon', () => {
    expect(venueIcon(baseMatch)).toBe('📍');
  });

  it('flags a non-home match accent and venue icon', () => {
    const match = { ...baseMatch, venue: 'MetLife Stadium', city: 'New York New Jersey' };

    expect(matchAccent(match)).toEqual({ favorite: true, home: false });
    expect(venueIcon(match)).toBe('🏟');
  });
});

describe('matchListDensity', () => {
  it('keeps comfortable rows up to and including the comfortable limit', () => {
    expect(matchListDensity(0)).toBe('comfortable');
    expect(matchListDensity(1)).toBe('comfortable');
    expect(matchListDensity(COMFORTABLE_ROW_LIMIT)).toBe('comfortable');
  });

  it('switches to compact rows once the list exceeds the comfortable limit', () => {
    expect(matchListDensity(COMFORTABLE_ROW_LIMIT + 1)).toBe('compact');
    // A busy two-day group-stage window (~14 games) and beyond stays compact, so
    // every match fits the full-height panel with no scrolling.
    expect(matchListDensity(14)).toBe('compact');
    expect(matchListDensity(16)).toBe('compact');
  });
});
