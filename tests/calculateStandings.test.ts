import { describe, it, expect } from 'vitest';
import { calculateStandings } from '../src/server/normalize/calculateStandings.js';
import type { Match } from '../src/shared/types.js';

function gm(home: string, away: string, hs: number, as: number): Match {
  return {
    id: `${home}-${away}`,
    stage: 'group',
    group: 'A',
    homeTeam: { id: home, name: home },
    awayTeam: { id: away, name: away },
    kickoffUtc: '2026-06-11T19:00:00Z',
    status: 'finished',
    homeScore: hs,
    awayScore: as,
  };
}

describe('calculateStandings', () => {
  it('awards points and sorts by points then goal difference', () => {
    const matches = [
      gm('AAA', 'BBB', 2, 0), // AAA win
      gm('CCC', 'DDD', 1, 1), // draw
      gm('AAA', 'CCC', 1, 0), // AAA win
    ];
    const table = calculateStandings(matches);
    const groupA = table.filter((s) => s.group === 'A').sort((a, b) => a.rank - b.rank);

    expect(groupA[0].team.id).toBe('AAA');
    expect(groupA[0].points).toBe(6);
    expect(groupA[0].goalDifference).toBe(3);
    expect(groupA[0].rank).toBe(1);

    const ccc = groupA.find((s) => s.team.id === 'CCC')!;
    expect(ccc.points).toBe(1);
  });

  it('includes teams that have not played yet', () => {
    const scheduled: Match = { ...gm('AAA', 'BBB', 0, 0), status: 'scheduled', homeScore: undefined, awayScore: undefined };
    const table = calculateStandings([scheduled]);
    expect(table).toHaveLength(2);
    expect(table.every((s) => s.played === 0 && s.points === 0)).toBe(true);
  });
});
