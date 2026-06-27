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

describe('resolveBracket — best-thirds selection + ordering', () => {
  // All 12 groups (A–L). Each group's rank-3 team is crafted so the global
  // ranking exercises every tiebreak level of the documented rule, in order:
  //   points → goal difference → goals for → fewest goals against → team name.
  // Stats per group: [points, goalDifference, goalsFor, goalsAgainst].
  const THIRD_STATS: Record<string, [number, number, number, number]> = {
    A: [6, 3, 5, 2], // ties B on pts/gd/gf/ga → split by name (T_A < T_B)
    B: [6, 3, 5, 2], // ↑
    C: [6, 3, 5, 4], // ties A/B on pts/gd/gf but worse ga → ranks below them
    D: [6, 3, 7, 2], // ties on pts/gd but higher gf → above A/B/C
    E: [6, 5, 5, 2], // ties on pts but higher gd → above all other pts-6
    F: [7, 4, 6, 2], // highest points → overall #1
    G: [4, 1, 3, 2], // pts-4, lower gd than H
    H: [4, 2, 3, 2], // pts-4, higher gd → above G
    I: [3, 1, 2, 2], // pts-3, above J on gd  — excluded (9th)
    J: [3, 0, 2, 2], // pts-3                 — excluded (10th)
    K: [1, 0, 1, 2], //                        — excluded (11th)
    L: [0, -1, 1, 3], //                       — excluded (12th)
  };
  const GROUPS = Object.keys(THIRD_STATS);

  // Documented order, best first. Top 8 advance; I/J/K/L are cut.
  const EXPECTED_ORDER = ['T_F', 'T_E', 'T_D', 'T_A', 'T_B', 'T_C', 'T_H', 'T_G'];
  const EXCLUDED = ['T_I', 'T_J', 'T_K', 'T_L'];

  function thirdsStandings(): Standing[] {
    return GROUPS.map((g) => {
      const [points, goalDifference, goalsFor, goalsAgainst] = THIRD_STATS[g];
      return standing(g, `T_${g}`, 3, { points, goalDifference, goalsFor, goalsAgainst });
    });
  }

  // One bracket node per best-third slot (#1..#8); the away slot stays unresolved.
  const nodes: BracketNode[] = Array.from({ length: 8 }, (_, i) => ({
    id: `r32-${i + 1}`,
    stage: 'round_of_32',
    label: `R32 ${i + 1}`,
    homeSource: `Best 3rd #${i + 1}`,
    awaySource: 'Winner R32-99', // intentionally never resolves
  }));

  it('selects exactly the 8 best thirds and orders them deterministically by the documented rule', () => {
    // Every group finished -> the cross-group third-place gate is open.
    const matches = GROUPS.map((g) => gm(g, `${g}1`, `${g}2`, 1, 0));
    const resolved = resolveBracket(matches, thirdsStandings(), nodes);

    const selected = resolved.map((n) => n.home.team?.id);
    // (a) exactly 8 slots resolve to a team.
    expect(selected.filter((id) => id != null)).toHaveLength(8);
    // (b) they are the correct 8 — none of the cut teams appear.
    expect(selected).toEqual(expect.arrayContaining(EXPECTED_ORDER));
    for (const cut of EXCLUDED) expect(selected).not.toContain(cut);
    // (c) tiebreak ordering resolves deterministically, slot #n = nth best third.
    expect(selected).toEqual(EXPECTED_ORDER);
  });

  it('resolves no best-third until every group is finished (cross-group gate)', () => {
    // Same data, but one group's match is still scheduled -> gate stays closed.
    const matches = GROUPS.map((g, i) =>
      i === 0
        ? { ...gm(g, `${g}1`, `${g}2`, 1, 0), status: 'scheduled' as const, homeScore: undefined, awayScore: undefined }
        : gm(g, `${g}1`, `${g}2`, 1, 0),
    );
    const resolved = resolveBracket(matches, thirdsStandings(), nodes);
    expect(resolved.every((n) => n.home.team == null)).toBe(true);
  });
});

describe('resolveBracket — penalty-decided R32 propagates winner to R16', () => {
  it('fills the next-round slot when a knockout match is decided on penalties', () => {
    const nodes: BracketNode[] = [
      { id: 'r32-1', stage: 'round_of_32', label: 'R32 1', homeSource: 'Winner Group A', awaySource: 'Runner-up Group A', winnerFeedsTo: 'r16-1' },
      { id: 'r32-2', stage: 'round_of_32', label: 'R32 2', homeSource: 'Winner Group B', awaySource: 'Runner-up Group B', winnerFeedsTo: 'r16-1' },
      { id: 'r16-1', stage: 'round_of_16', label: 'R16 1', homeSource: 'Winner R32-1', awaySource: 'Winner R32-2' },
    ];
    const matches: Match[] = [
      gm('A', 'JPN', 'XXX', 2, 0),
      gm('A', 'CRO', 'YYY', 2, 0),
      gm('B', 'EEE', 'FFF', 2, 0),
      gm('B', 'GGG', 'HHH', 1, 0),
      // Japan vs Croatia: ft 1-1, decided on pens 1-3 -> Croatia wins.
      {
        id: 'k1', stage: 'round_of_32',
        homeTeam: { id: 'JPN', name: 'Japan' }, awayTeam: { id: 'CRO', name: 'Croatia' },
        kickoffUtc: '2022-12-05T14:00:00Z', status: 'finished',
        homeScore: 1, awayScore: 1,
        winnerTeamId: 'CRO',
        decidedBy: 'PENALTY_SHOOTOUT', penaltyHome: 1, penaltyAway: 3,
      },
      { id: 'k2', stage: 'round_of_32', homeTeam: { id: 'EEE', name: 'EEE' }, awayTeam: { id: 'GGG', name: 'GGG' }, kickoffUtc: '2022-12-05T18:00:00Z', status: 'finished', homeScore: 2, awayScore: 1, winnerTeamId: 'EEE' },
    ];
    const standings = [
      standing('A', 'JPN', 1), standing('A', 'CRO', 2),
      standing('B', 'EEE', 1), standing('B', 'GGG', 2),
    ];
    const resolved = resolveBracket(matches, standings, nodes);

    const r32 = resolved.find((n) => n.id === 'r32-1')!;
    expect(r32.winner?.id).toBe('CRO');
    expect(r32.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(r32.penaltyHome).toBe(1);
    expect(r32.penaltyAway).toBe(3);

    // Winner propagated forward: R16-1 now has Croatia in its home slot.
    const r16 = resolved.find((n) => n.id === 'r16-1')!;
    expect(r16.home.team?.id).toBe('CRO');
    expect(r16.away.team?.id).toBe('EEE');
    expect(r16.decided).toBe(true);
  });
});

describe('resolveBracket — third-place loser-pull vs final winner-feed', () => {
  it('routes the two semifinal losers to the third-place node and the winners to the final', () => {
    const nodes: BracketNode[] = [
      { id: 'sf-1', stage: 'semifinal', label: 'SF 1', matchId: 's1', homeSource: 'Winner QF-1', awaySource: 'Winner QF-2', winnerFeedsTo: 'final' },
      { id: 'sf-2', stage: 'semifinal', label: 'SF 2', matchId: 's2', homeSource: 'Winner QF-3', awaySource: 'Winner QF-4', winnerFeedsTo: 'final' },
      { id: 'third-place', stage: 'third_place', label: '3rd', homeSource: 'Loser SF-1', awaySource: 'Loser SF-2' },
      { id: 'final', stage: 'final', label: 'Final', homeSource: 'Winner SF-1', awaySource: 'Winner SF-2' },
    ];
    const matches: Match[] = [
      // SF-1: SEA beats POR; SF-2: ARG beats BRA.
      { id: 's1', stage: 'semifinal', homeTeam: team('SEA'), awayTeam: team('POR'), kickoffUtc: '2026-07-14T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 1, winnerTeamId: 'SEA' },
      { id: 's2', stage: 'semifinal', homeTeam: team('BRA'), awayTeam: team('ARG'), kickoffUtc: '2026-07-15T19:00:00Z', status: 'finished', homeScore: 0, awayScore: 1, winnerTeamId: 'ARG' },
    ];
    const resolved = resolveBracket(matches, [], nodes);

    const third = resolved.find((n) => n.id === 'third-place')!;
    expect(third.home.team?.id).toBe('POR'); // loser of SF-1, not SEA
    expect(third.away.team?.id).toBe('BRA'); // loser of SF-2, not ARG
    expect(third.decided).toBe(true);

    const final = resolved.find((n) => n.id === 'final')!;
    expect(final.home.team?.id).toBe('SEA'); // winner of SF-1
    expect(final.away.team?.id).toBe('ARG'); // winner of SF-2
    expect(final.decided).toBe(true);
  });
});
