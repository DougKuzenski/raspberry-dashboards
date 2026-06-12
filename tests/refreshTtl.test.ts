import { describe, it, expect } from 'vitest';
import { refreshTtl } from '../src/server/providers/footballDataProvider.js';
import type { Match } from '../src/shared/types.js';

const now = new Date('2026-06-11T18:00:00Z').getTime();

function m(status: Match['status'], kickoffUtc: string): Match {
  return {
    id: kickoffUtc,
    stage: 'group',
    group: 'A',
    homeTeam: { id: 'AAA', name: 'A' },
    awayTeam: { id: 'BBB', name: 'B' },
    kickoffUtc,
    status,
  };
}

describe('refreshTtl (adaptive polling cadence)', () => {
  it('polls fast (45s) when a match is live', () => {
    const matches = [m('live', '2026-06-11T17:00:00Z'), m('scheduled', '2026-06-12T20:00:00Z')];
    expect(refreshTtl(matches, now)).toBe(45_000);
  });

  it('polls fast when the next kickoff is imminent (<15 min away)', () => {
    const matches = [m('scheduled', '2026-06-11T18:10:00Z')]; // 10 min out
    expect(refreshTtl(matches, now)).toBe(45_000);
  });

  it('sleeps until ~15 min before a far-off next kickoff, capped at 30 min', () => {
    // Next match in 2 hours -> would be 1h45m, capped to 30 min.
    const matches = [m('scheduled', '2026-06-11T20:00:00Z')];
    expect(refreshTtl(matches, now)).toBe(30 * 60_000);
  });

  it('returns a long idle TTL when nothing is upcoming (tournament over)', () => {
    const matches = [m('finished', '2026-06-10T20:00:00Z')];
    expect(refreshTtl(matches, now)).toBe(30 * 60_000);
  });
});
