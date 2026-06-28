import { describe, it, expect } from 'vitest';
import { buildKnockoutSkeleton, mergeKnockoutFixtures } from '../src/server/normalize/buildBracket.js';
import { resolveBracket } from '../src/shared/resolveBracket.js';
import type { Match, Stage, Standing, TeamRef } from '../src/shared/types.js';

// ---------------------------------------------------------------------------
// Helpers
//
// These tests prove the mapping keys off *slot identity*, never chronology, so
// kickoff times are deliberately irrelevant / out of order in most cases.
// ---------------------------------------------------------------------------

function team(id: string, name: string = id): TeamRef {
  return { id, name };
}

// A group-stage fixture, used purely to establish a team's group origin (the
// merge derives team -> group from these; status is irrelevant).
function groupMatch(group: string, homeId: string, awayId: string): Match {
  return {
    id: `g-${group}-${homeId}-${awayId}`,
    stage: 'group',
    group,
    homeTeam: team(homeId),
    awayTeam: team(awayId),
    kickoffUtc: '2026-06-15T18:00:00Z',
    status: 'scheduled',
  };
}

// A knockout fixture naming two real teams.
function koMatch(
  id: string,
  stage: Stage,
  homeId: string,
  awayId: string,
  kickoffUtc = '2026-07-01T18:00:00Z',
): Match {
  return {
    id,
    stage,
    homeTeam: team(homeId, homeId),
    awayTeam: team(awayId, awayId),
    kickoffUtc,
    status: 'scheduled',
  };
}

// A knockout fixture carrying OpenFootball-style placeholder slot labels.
function placeholderMatch(
  id: string,
  stage: Stage,
  homeLabel: string,
  awayLabel: string,
): Match {
  return {
    id,
    stage,
    homeTeam: { id: homeLabel, name: homeLabel },
    awayTeam: { id: awayLabel, name: awayLabel },
    kickoffUtc: '2026-07-01T18:00:00Z',
    status: 'scheduled',
  };
}

// A shared group context. Each team is pinned to a group so real-team knockout
// fixtures can be mapped to the node referencing that group. The groups are
// chosen so the example fixtures below are UNAMBIGUOUS (see comments per test):
//   USA=D, BIH=F, JPN=J, MAR=H  -> clean partner groups (winner node not a third)
//   CRO=E                       -> used to construct a deliberately ambiguous case
const GROUPS: Match[] = [
  groupMatch('D', 'USA', 'DD'),
  groupMatch('F', 'BIH', 'FF'),
  groupMatch('J', 'JPN', 'JJ'),
  groupMatch('H', 'MAR', 'HH'),
  groupMatch('E', 'CRO', 'EE'),
  groupMatch('A', 'ARG', 'AA'),
  groupMatch('G', 'GHA', 'GG'),
  groupMatch('I', 'ITA', 'II'),
  groupMatch('B', 'BEL', 'BB'),
  groupMatch('C', 'CMR', 'CC'),
];

function matchId(nodes: ReturnType<typeof buildKnockoutSkeleton>, id: string) {
  return nodes.find((n) => n.id === id)!.matchId;
}

// ---------------------------------------------------------------------------
// Slot identity from placeholder labels (OpenFootball-style)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — placeholder slot labels', () => {
  it('maps a "Winner Group X" / "3rd Group" fixture onto the matching node by label', () => {
    // r32-1 = [Winner Group A, Best 3rd #1]. "Winner Group A" uniquely identifies it.
    const fixture = placeholderMatch('of-1', 'round_of_32', 'Winner Group A', '3rd Group E');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-1')).toBe('of-1');
    // No other node is annotated.
    expect(result.filter((n) => n.id !== 'r32-1' && n.matchId != null)).toHaveLength(0);
  });

  it('maps a [Runner-up B, Runner-up C] fixture onto r32-2 (both labels agree)', () => {
    const fixture = placeholderMatch('of-2', 'round_of_32', 'Runner-up Group B', 'Runner-up Group C');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-2')).toBe('of-2');
  });

  it('ignores home/away orientation — swapped labels still hit the same node', () => {
    const fixture = placeholderMatch('of-3', 'round_of_32', '3rd Group E', 'Winner Group D');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-3')).toBe('of-3'); // r32-3 = [Winner Group D, Best 3rd #2]
  });
});

// ---------------------------------------------------------------------------
// Slot identity from real teams (football-data-style), via group origin
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — real teams mapped by group origin', () => {
  it('maps USA (Group D) vs BIH (Group F) onto r32-3 = [Winner Group D, Best 3rd #2]', () => {
    // USA pins the "Winner Group D" slot; BIH (Group F) can only be the best-third
    // here — Group F's own winner node (r32-4) pairs with a runner-up, not a third,
    // so there is no rival interpretation. Unambiguous.
    const fixture = koMatch('fd-537421', 'round_of_32', 'USA', 'BIH');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-3')).toBe('fd-537421');
    expect(result.filter((n) => n.id !== 'r32-3' && n.matchId != null)).toHaveLength(0);
  });

  it('does NOT use chronology: a later-slot fixture with an EARLIER kickoff keeps its own slot', () => {
    // r32-7 (JPN/MAR) kicks off BEFORE r32-3 (USA/BIH). Positional/chronological
    // mapping would put the earlier-kickoff fixture in r32-1/r32-3; identity must not.
    const r32_3 = koMatch('fd-3', 'round_of_32', 'USA', 'BIH', '2026-07-10T18:00:00Z');
    const r32_7 = koMatch('fd-7', 'round_of_32', 'JPN', 'MAR', '2026-07-01T18:00:00Z');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_3, r32_7]);
    expect(matchId(result, 'r32-3')).toBe('fd-3'); // r32-3 = [Winner D, Best 3rd #2]
    expect(matchId(result, 'r32-7')).toBe('fd-7'); // r32-7 = [Winner J, Best 3rd #4]
  });

  it('handles equal kickoff times within a round — each fixture lands on its own slot', () => {
    const sameTime = '2026-07-01T18:00:00Z';
    const r32_3 = koMatch('fd-a', 'round_of_32', 'USA', 'BIH', sameTime);
    const r32_7 = koMatch('fd-b', 'round_of_32', 'JPN', 'MAR', sameTime);
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_3, r32_7]);
    expect(matchId(result, 'r32-3')).toBe('fd-a');
    expect(matchId(result, 'r32-7')).toBe('fd-b');
  });

  it('partial publication: only later-slot fixtures published still map to their CORRECT slots', () => {
    // Earlier R32 slots (r32-1, r32-2, ...) are NOT published. The USA/BIH fixture
    // must still land on r32-3 (not get pulled forward to r32-1), and JPN/MAR on r32-7.
    const r32_3 = koMatch('fd-3', 'round_of_32', 'USA', 'BIH');
    const r32_7 = koMatch('fd-7', 'round_of_32', 'JPN', 'MAR');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_3, r32_7]);
    expect(matchId(result, 'r32-3')).toBe('fd-3');
    expect(matchId(result, 'r32-7')).toBe('fd-7');
    expect(matchId(result, 'r32-1')).toBeUndefined();
    expect(matchId(result, 'r32-2')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fail-safe: ambiguous / unidentifiable fixtures are left unannotated
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — fail safe over guessing', () => {
  it('leaves an ambiguous real-team fixture UNANNOTATED rather than guessing a slot', () => {
    // USA (Group D) vs CRO (Group E). This fits TWO nodes:
    //   r32-3  = [Winner D, Best 3rd #2]  -> USA=Winner D, CRO=best-third
    //   r32-11 = [Winner E, Best 3rd #6]  -> CRO=Winner E, USA=best-third
    // Cannot tell which without final standings, so neither node is annotated.
    const fixture = koMatch('fd-amb', 'round_of_32', 'USA', 'CRO');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-3')).toBeUndefined();
    expect(matchId(result, 'r32-11')).toBeUndefined();
    expect(result.filter((n) => n.matchId != null)).toHaveLength(0);
  });

  it('leaves a TBD-vs-TBD fixture unannotated (no slot identity at all)', () => {
    const fixture: Match = {
      id: 'fd-tbd',
      stage: 'round_of_32',
      homeTeam: { id: 'TBD', name: 'TBD' },
      awayTeam: { id: 'TBD2', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(result.filter((n) => n.matchId != null)).toHaveLength(0);
  });

  it('leaves a real-team fixture with one TBD side unannotated (cannot pin the slot)', () => {
    const fixture: Match = {
      id: 'fd-half',
      stage: 'round_of_32',
      homeTeam: team('USA'),
      awayTeam: { id: 'TBD', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(result.filter((n) => n.matchId != null)).toHaveLength(0);
  });

});

// ---------------------------------------------------------------------------
// FIX 1 — rank inversion is impossible (a real team pins a GROUP, never W vs R)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — no rank-inverted annotation', () => {
  it('refuses a [group-A, group-D] fixture: cannot tell winner from runner-up', () => {
    // ARG (Group A) vs USA (Group D) structurally fits r32-1 [Winner A, ...],
    // r32-3 [Winner D, ...] and r32-10 [Runner-up A, Runner-up D]. The link to the
    // W-node and the R-node of BOTH groups is rank-agnostic -> refuse outright.
    const fixture = koMatch('fd-rank', 'round_of_32', 'ARG', 'USA');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(result.filter((n) => n.matchId != null)).toHaveLength(0);
  });

  it('does NOT fall back to the opposite-rank node even when the correct nodes are taken', () => {
    // Pre-claim r32-1 (Winner A) and r32-3 (Winner D) via overrides. A naive
    // "assign to the last remaining open candidate" would now strand ARG/USA onto
    // r32-10 [Runner-up A, Runner-up D] — a rank-inverted guess. It must not.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-1')!.matchId = 'override-1';
    skeleton.find((n) => n.id === 'r32-3')!.matchId = 'override-3';
    const fixture = koMatch('fd-rank', 'round_of_32', 'ARG', 'USA');
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, fixture]);
    expect(matchId(result, 'r32-10')).toBeUndefined();
    expect(result.some((n) => n.matchId === 'fd-rank')).toBe(false);
    // Overrides untouched.
    expect(matchId(result, 'r32-1')).toBe('override-1');
    expect(matchId(result, 'r32-3')).toBe('override-3');
  });

  it('still maps the unambiguous case (USA/BIH): rank is forced by structure, not guessed', () => {
    // USA can only be Winner D here (the Runner-up D node r32-10 needs a Group-A
    // partner, and BIH is Group F), so there is no rank ambiguity to refuse.
    const fixture = koMatch('fd-ok', 'round_of_32', 'USA', 'BIH');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-3')).toBe('fd-ok');
  });
});

// ---------------------------------------------------------------------------
// FIX 2 — iterative elimination never drops a resolvable fixture
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — iterative, order-independent assignment', () => {
  // A mixed batch: two cleanly-resolvable fixtures, one cross-group-ambiguous,
  // one rank-ambiguous. The resolvable two must ALWAYS map; the other two never.
  // All fixtures use distinct teams (each nation plays one R32 match, as in reality).
  const resolvableA = koMatch('fd-3', 'round_of_32', 'USA', 'BIH'); // -> r32-3
  const resolvableB = koMatch('fd-7', 'round_of_32', 'JPN', 'MAR'); // -> r32-7
  const crossAmbiguous = koMatch('fd-amb', 'round_of_32', 'GHA', 'ITA'); // r32-5 or r32-13
  const rankAmbiguous = koMatch('fd-rank', 'round_of_32', 'BEL', 'CMR'); // [Group B, Group C] -> rank-poisoned

  function permute<T>(arr: T[], seed: number): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = (i * 7 + seed) % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  it('assigns every uniquely-resolvable fixture regardless of input order', () => {
    const all = [resolvableA, resolvableB, crossAmbiguous, rankAmbiguous];
    for (let seed = 0; seed < 5; seed++) {
      const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, ...permute(all, seed)]);
      // Note: fd-3 and fd-amb both contain USA; whichever wins r32-3, only the
      // unambiguous fd-3 may be assigned and fd-amb must stay unmapped.
      expect(matchId(result, 'r32-3')).toBe('fd-3');
      expect(matchId(result, 'r32-7')).toBe('fd-7');
      // Nothing else is ever annotated.
      const annotated = result.filter((n) => n.matchId != null).map((n) => n.id).sort();
      expect(annotated).toEqual(['r32-3', 'r32-7']);
    }
  });

  it('an override consuming a slot does not strand or shift independent fixtures', () => {
    // r32-3 is pre-claimed by an override whose fixture is ABSENT. The override is
    // preserved, USA/BIH (which only fits the taken r32-3) is dropped via the
    // elimination loop, and the independent JPN/MAR still resolves to r32-7.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-3')!.matchId = 'manual-absent';
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, resolvableA, resolvableB]);
    expect(matchId(result, 'r32-3')).toBe('manual-absent');
    expect(matchId(result, 'r32-7')).toBe('fd-7');
    expect(result.some((n) => n.matchId === 'fd-3')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FIX 3 — later rounds resolve by propagation, not matchId (intended design)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — feed rounds are propagation-driven by design', () => {
  it('intentionally leaves R16/QF/SF feed fixtures unannotated (no keyable slot id)', () => {
    // Feed slots ("Winner R32-n") carry no group identity and providers publish
    // TBD for undecided knockout slots, so these rounds are NOT matchId-mapped —
    // resolveBracket advances them via winner propagation instead (see below).
    const r16 = koMatch('fd-r16', 'round_of_16', 'USA', 'JPN');
    const qf = koMatch('fd-qf', 'quarterfinal', 'BIH', 'MAR');
    const sf = koMatch('fd-sf', 'semifinal', 'USA', 'CRO');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r16, qf, sf]);
    const feedStages = ['round_of_16', 'quarterfinal', 'semifinal'] as const;
    expect(result.filter((n) => feedStages.includes(n.stage as never) && n.matchId != null)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Single-node stages (third-place, final) map unambiguously
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — single-node stages', () => {
  it('maps a final fixture onto the one final node, independent of other stages', () => {
    const r32 = koMatch('fd-3', 'round_of_32', 'USA', 'BIH'); // -> r32-3
    const final = koMatch('fd-final', 'final', 'USA', 'JPN');
    const third = koMatch('fd-third', 'third_place', 'BIH', 'MAR');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32, final, third]);
    expect(matchId(result, 'final')).toBe('fd-final');
    expect(matchId(result, 'third-place')).toBe('fd-third');
    // Per-stage independence: the R32 mapping is unaffected.
    expect(matchId(result, 'r32-3')).toBe('fd-3');
  });
});

// ---------------------------------------------------------------------------
// Manual overrides / pre-set matchIds
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — manual overrides', () => {
  it('preserves a pre-set matchId and never overwrites it', () => {
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-3')!.matchId = 'manual-override';
    const fixture = koMatch('fd-3', 'round_of_32', 'USA', 'BIH'); // would otherwise hit r32-3
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, fixture]);
    expect(matchId(result, 'r32-3')).toBe('manual-override');
  });

  it('an override node whose fixture is ABSENT does not shift/misalign other fixtures', () => {
    // r32-3 is overridden to a fixture NOT present in `matches`. The published
    // USA/BIH fixture (which targets r32-3) must NOT steal another slot, and the
    // unrelated JPN/MAR fixture must still map to r32-7 correctly.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-3')!.matchId = 'manual-absent';
    const usaBih = koMatch('fd-3', 'round_of_32', 'USA', 'BIH'); // targets the taken r32-3
    const jpnMar = koMatch('fd-7', 'round_of_32', 'JPN', 'MAR'); // targets r32-7
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, usaBih, jpnMar]);

    expect(matchId(result, 'r32-3')).toBe('manual-absent'); // override preserved
    expect(matchId(result, 'r32-7')).toBe('fd-7'); // remaining fixture still correct
    // The displaced USA/BIH fixture was NOT mis-assigned to any other node.
    expect(result.some((n) => n.matchId === 'fd-3')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Non-mutation
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — purity', () => {
  it('does not mutate the original skeleton nodes', () => {
    const skeleton = buildKnockoutSkeleton();
    const origR32_3 = skeleton.find((n) => n.id === 'r32-3')!;
    mergeKnockoutFixtures(skeleton, [...GROUPS, koMatch('fd-3', 'round_of_32', 'USA', 'BIH')]);
    expect(origR32_3.matchId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveBracket integration
// ---------------------------------------------------------------------------

function standing(group: string, id: string, rank: number): Standing {
  return {
    group,
    team: team(id),
    played: 3, won: 1, drawn: 1, lost: 1,
    goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 4,
    rank,
  };
}

describe('fixture-driven bracket — resolveBracket integration', () => {
  it('(a) shows real teams from a published fixture before the group stage ends', () => {
    // football-data names USA vs BIH on the r32-3 fixture while Group D is still in
    // progress. Identity mapping pins it to r32-3; the resolver shows both teams.
    const usaBih: Match = {
      id: 'fd-537421',
      stage: 'round_of_32',
      homeTeam: team('USA', 'United States'),
      awayTeam: team('BIH', 'Bosnia-Herzegovina'),
      kickoffUtc: '2026-07-01T20:00:00Z',
      status: 'scheduled',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, usaBih]);
    expect(matchId(augmented, 'r32-3')).toBe('fd-537421');

    // Groups are NOT decided (group fixtures are still 'scheduled'), so the resolver
    // must lean on the matchId, not standings.
    const resolved = resolveBracket([...GROUPS, usaBih], [], augmented);
    const r32_3 = resolved.find((n) => n.id === 'r32-3')!;
    expect(r32_3.matchId).toBe('fd-537421');
    expect(r32_3.home.team?.id).toBe('USA');
    expect(r32_3.away.team?.id).toBe('BIH');
    expect(r32_3.decided).toBe(true);
  });

  it('(b) a placeholder/TBD slot keeps its synthesized label (no wrong override)', () => {
    // Group A decided -> Winner A = AAA from standings. An unannotated r32-1 keeps
    // the group-derived team on the home slot and the placeholder on the third slot.
    const groupMatches: Match[] = [
      { id: 'g1', stage: 'group', group: 'A', homeTeam: team('AAA'), awayTeam: team('BBB'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 0, winnerTeamId: 'AAA' },
      { id: 'g2', stage: 'group', group: 'A', homeTeam: team('CCC'), awayTeam: team('DDD'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'CCC' },
    ];
    const standings = [standing('A', 'AAA', 1), standing('A', 'CCC', 2)];

    // A TBD fixture carries no identity -> r32-1 is left unannotated (fail safe).
    const tbdFixture: Match = {
      id: 'fd-tbd-1',
      stage: 'round_of_32',
      homeTeam: { id: 'TBD', name: 'TBD' },
      awayTeam: { id: 'TBD2', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...groupMatches, tbdFixture]);
    expect(matchId(augmented, 'r32-1')).toBeUndefined();

    const resolved = resolveBracket([...groupMatches, tbdFixture], standings, augmented);
    const r32_1 = resolved.find((n) => n.id === 'r32-1')!;
    expect(r32_1.home.team?.id).toBe('AAA'); // Winner Group A from standings
    expect(r32_1.away.team).toBeUndefined(); // Best 3rd #1 not yet known
    expect(r32_1.home.source).toBe('Winner Group A');
    expect(r32_1.away.source).toBe('Best 3rd #1');
    expect(r32_1.decided).toBe(false);
  });

  it('(c) propagates the winner of a fixture-mapped node into the next round', () => {
    // USA beat BIH in r32-3; the winner should flow into r16-2 (fed by Winner R32-3).
    const usaBih: Match = {
      id: 'fd-001',
      stage: 'round_of_32',
      homeTeam: team('USA', 'United States'),
      awayTeam: team('BIH', 'Bosnia-Herzegovina'),
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'finished',
      homeScore: 2,
      awayScore: 0,
      winnerTeamId: 'USA',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, usaBih]);
    expect(matchId(augmented, 'r32-3')).toBe('fd-001');

    const resolved = resolveBracket([...GROUPS, usaBih], [], augmented);
    const r32_3 = resolved.find((n) => n.id === 'r32-3')!;
    expect(r32_3.winner?.id).toBe('USA');
    expect(r32_3.home.isWinner).toBe(true);
    expect(r32_3.home.score).toBe(2);

    // r16-2 home source = "Winner R32-3" -> receives USA via propagation.
    const r16_2 = resolved.find((n) => n.id === 'r16-2')!;
    expect(r16_2.home.team?.id).toBe('USA');
  });

  it('(d) advances the bracket through R16 by propagation alone — no R16 matchId', () => {
    // Two finished R32 results (linked by matchId, as the merge / overrides would
    // do for r32-1 and r32-2). The R16 node they both feed must populate with the
    // correct propagated winners WITHOUT any matchId of its own — proving feed
    // rounds advance via winner propagation, the intended Option-A design.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-1')!.matchId = 'm1';
    skeleton.find((n) => n.id === 'r32-2')!.matchId = 'm2';

    const m1: Match = {
      id: 'm1', stage: 'round_of_32',
      homeTeam: team('AAA'), awayTeam: team('BBB'),
      kickoffUtc: '2026-07-01T18:00:00Z', status: 'finished',
      homeScore: 2, awayScore: 1, winnerTeamId: 'AAA',
    };
    const m2: Match = {
      id: 'm2', stage: 'round_of_32',
      homeTeam: team('CCC'), awayTeam: team('DDD'),
      kickoffUtc: '2026-07-02T18:00:00Z', status: 'finished',
      homeScore: 0, awayScore: 3, winnerTeamId: 'DDD',
    };

    const resolved = resolveBracket([m1, m2], [], skeleton);
    const r16_1 = resolved.find((n) => n.id === 'r16-1')!; // fed by Winner R32-1/R32-2
    expect(r16_1.matchId).toBeUndefined(); // not identity-mapped
    expect(r16_1.home.team?.id).toBe('AAA'); // winner of r32-1
    expect(r16_1.away.team?.id).toBe('DDD'); // winner of r32-2
    expect(r16_1.decided).toBe(true);
  });
});
