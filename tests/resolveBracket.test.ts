import { describe, it, expect } from 'vitest';
import { resolveBracket } from '../src/shared/resolveBracket.js';
import { buildKnockoutSkeleton } from '../src/server/normalize/buildBracket.js';
import type { BracketNode, Match, Standing } from '../src/shared/types.js';

function team(id: string) {
  return { id, name: id };
}

// A finished group match between two teams.
function gm(group: string, home: string, away: string, hs: number, as: number): Match {
  return {
    id: `g-${group}-${home}-${away}`,
    stage: 'group',
    group,
    homeTeam: team(home),
    awayTeam: team(away),
    kickoffUtc: '2026-06-11T19:00:00Z',
    status: 'finished',
    homeScore: hs,
    awayScore: as,
    winnerTeamId: hs > as ? home : as > hs ? away : undefined,
  };
}

function standing(group: string, id: string, rank: number, extra: Partial<Standing> = {}): Standing {
  return {
    group,
    team: team(id),
    played: 3, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    rank,
    ...extra,
  };
}

describe('resolveBracket — group resolution', () => {
  const node: BracketNode = {
    id: 'r32-1', stage: 'round_of_32', label: 'R32 1',
    homeSource: 'Winner Group A', awaySource: 'Runner-up Group A',
  };

  it('leaves slots as placeholders until the group is decided', () => {
    const matches: Match[] = [
      gm('A', 'AAA', 'BBB', 2, 0),
      { ...gm('A', 'CCC', 'DDD', 1, 1), status: 'scheduled', homeScore: undefined, awayScore: undefined },
    ];
    const standings = [standing('A', 'AAA', 1), standing('A', 'CCC', 2)];
    const [r] = resolveBracket(matches, standings, [node]);
    expect(r.home.team).toBeUndefined();
    expect(r.home.source).toBe('Winner Group A');
    expect(r.decided).toBe(false);
  });

  it('resolves winner (rank 1) and runner-up (rank 2) once the group is decided', () => {
    const matches: Match[] = [
      gm('A', 'AAA', 'BBB', 2, 0),
      gm('A', 'CCC', 'DDD', 1, 0),
    ];
    const standings = [standing('A', 'AAA', 1), standing('A', 'CCC', 2)];
    const [r] = resolveBracket(matches, standings, [node]);
    expect(r.home.team?.id).toBe('AAA');
    expect(r.away.team?.id).toBe('CCC');
    expect(r.decided).toBe(true);
  });
});

describe('resolveBracket — best thirds', () => {
  const node: BracketNode = {
    id: 'r32-1', stage: 'round_of_32', label: 'R32 1',
    homeSource: 'Winner Group A', awaySource: 'Best 3rd #1',
  };

  it('ranks the best third by points then goal difference, only once all groups finish', () => {
    const matches: Match[] = [gm('A', 'AAA', 'BBB', 1, 0), gm('B', 'EEE', 'FFF', 1, 0)];
    const standings = [
      standing('A', 'AAA', 1, { points: 9 }),
      standing('A', 'T_A', 3, { points: 3, goalDifference: 1 }),
      standing('B', 'T_B', 3, { points: 3, goalDifference: 5 }),
    ];
    const [r] = resolveBracket(matches, standings, [node]);
    // T_B has the better goal difference among the two thirds.
    expect(r.away.team?.id).toBe('T_B');
  });
});

describe('resolveBracket — winner propagation via winnerFeedsTo', () => {
  it('feeds a finished node winner forward into the slot that references it', () => {
    const nodes: BracketNode[] = [
      { id: 'r32-1', stage: 'round_of_32', label: 'R32 1', homeSource: 'Winner Group A', awaySource: 'Runner-up Group A', winnerFeedsTo: 'r16-1' },
      { id: 'r32-2', stage: 'round_of_32', label: 'R32 2', homeSource: 'Winner Group B', awaySource: 'Runner-up Group B', winnerFeedsTo: 'r16-1' },
      { id: 'r16-1', stage: 'round_of_16', label: 'R16 1', homeSource: 'Winner R32-1', awaySource: 'Winner R32-2', winnerFeedsTo: 'final' },
    ];
    const matches: Match[] = [
      gm('A', 'AAA', 'BBB', 2, 0),
      gm('A', 'CCC', 'DDD', 1, 0),
      gm('B', 'EEE', 'FFF', 2, 0),
      gm('B', 'GGG', 'HHH', 1, 0),
      // R32 knockout results (linked by stage + teams, no matchId needed).
      { id: 'k1', stage: 'round_of_32', homeTeam: team('AAA'), awayTeam: team('CCC'), kickoffUtc: '2026-06-30T19:00:00Z', status: 'finished', homeScore: 3, awayScore: 1, winnerTeamId: 'AAA' },
      { id: 'k2', stage: 'round_of_32', homeTeam: team('EEE'), awayTeam: team('GGG'), kickoffUtc: '2026-06-30T22:00:00Z', status: 'finished', homeScore: 0, awayScore: 2, winnerTeamId: 'GGG' },
    ];
    const standings = [
      standing('A', 'AAA', 1), standing('A', 'CCC', 2),
      standing('B', 'EEE', 1), standing('B', 'GGG', 2),
    ];
    const resolved = resolveBracket(matches, standings, nodes);
    const r16 = resolved.find((n) => n.id === 'r16-1')!;
    expect(r16.home.team?.id).toBe('AAA'); // winner of R32-1
    expect(r16.away.team?.id).toBe('GGG'); // winner of R32-2
    expect(r16.decided).toBe(true);

    const r32a = resolved.find((n) => n.id === 'r32-1')!;
    expect(r32a.winner?.id).toBe('AAA');
    expect(r32a.home.isWinner).toBe(true);
    expect(r32a.home.score).toBe(3);
    expect(r32a.away.score).toBe(1);
    expect(r32a.status).toBe('finished');
  });
});

describe('resolveBracket — third place from semifinal losers', () => {
  it('pulls "Loser SF-1" / "Loser SF-2" into the third-place node', () => {
    const nodes: BracketNode[] = [
      { id: 'sf-1', stage: 'semifinal', label: 'SF 1', homeSource: 'X', awaySource: 'Y', winnerFeedsTo: 'final' },
      { id: 'sf-2', stage: 'semifinal', label: 'SF 2', homeSource: 'Z', awaySource: 'W', winnerFeedsTo: 'final' },
      { id: 'third-place', stage: 'third_place', label: '3rd', homeSource: 'Loser SF-1', awaySource: 'Loser SF-2' },
    ];
    const matches: Match[] = [
      { id: 's1', stage: 'semifinal', homeTeam: team('XXX'), awayTeam: team('YYY'), kickoffUtc: '2026-07-10T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 1, winnerTeamId: 'XXX' },
      { id: 's2', stage: 'semifinal', homeTeam: team('ZZZ'), awayTeam: team('WWW'), kickoffUtc: '2026-07-11T19:00:00Z', status: 'finished', homeScore: 0, awayScore: 3, winnerTeamId: 'WWW' },
    ];
    // sf nodes need their slot teams to find the matches; seed via matchId.
    nodes[0].matchId = 's1';
    nodes[1].matchId = 's2';
    const resolved = resolveBracket(matches, [], nodes);
    const third = resolved.find((n) => n.id === 'third-place')!;
    expect(third.home.team?.id).toBe('YYY'); // loser of SF-1
    expect(third.away.team?.id).toBe('ZZZ'); // loser of SF-2
  });
});

describe('resolveBracket — full skeleton', () => {
  it('produces 32 nodes and resolves nothing before any group finishes', () => {
    const resolved = resolveBracket([], [], buildKnockoutSkeleton());
    expect(resolved).toHaveLength(32);
    expect(resolved.every((n) => !n.decided)).toBe(true);
    expect(resolved.find((n) => n.id === 'final')?.home.source).toBe('Winner SF-1');
  });
});
