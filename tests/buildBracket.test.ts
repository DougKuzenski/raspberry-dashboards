import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildKnockoutSkeleton, mergeKnockoutFixtures } from '../src/server/normalize/buildBracket.js';
import { resolveBracket } from '../src/shared/resolveBracket.js';
import type { BracketNode, Match, Stage, Standing, TeamRef } from '../src/shared/types.js';

// ---------------------------------------------------------------------------
// Helpers
//
// These tests prove the mapping keys off *slot identity*, never chronology, so
// kickoff times are deliberately irrelevant / out of order in most cases.
//
// They also pin the corrected FIFA 2026 R32 layout (see R32_PAIRINGS): a real
// team's *group* identifies its node, so the per-test group assignments below
// target the real bracket. E.g. USA won Group D and Group D's winner sits on
// r32-7 = [Winner Group D, Best 3rd #3].
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
// fixtures can be mapped to the node referencing that group. Groups are chosen so
// the example fixtures below are UNAMBIGUOUS (see comments per test). Under the
// corrected R32 table:
//   USA=D -> Winner D on r32-7 = [Winner D, Best 3rd #3]
//   BIH=F -> F's winner sits on r32-4 = [Winner F, Runner-up C] (a runner pair,
//            NOT a third), so BIH can only be the best-third opposite USA -> clean.
//   JPN=G -> Winner G on r32-8 = [Winner G, Best 3rd #4]; MAR=H partner -> clean.
//   CRO=E -> Winner E on r32-1 = [Winner E, Best 3rd #1] (used for an ambiguous case)
//   GHA=G -> shares the runner pair r32-14 = [Runner-up D, Runner-up G] with USA=D,
//            which is how the rank-inversion guard is exercised.
const GROUPS: Match[] = [
  groupMatch('D', 'USA', 'DD'),
  groupMatch('F', 'BIH', 'FF'),
  groupMatch('G', 'JPN', 'GG'),
  groupMatch('H', 'MAR', 'HH'),
  groupMatch('E', 'CRO', 'EE'),
  groupMatch('G', 'GHA', 'GG2'),
  groupMatch('A', 'ITA', 'AA'),
  groupMatch('K', 'EGY', 'KK'),
  groupMatch('E', 'SWE', 'EE2'),
  groupMatch('I', 'NOR', 'II'),
];

function matchId(nodes: ReturnType<typeof buildKnockoutSkeleton>, id: string) {
  return nodes.find((n) => n.id === id)!.matchId;
}

// ---------------------------------------------------------------------------
// Slot identity from placeholder labels (OpenFootball-style)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — placeholder slot labels', () => {
  it('maps a "Winner Group X" / "3rd Group" fixture onto the matching node by label', () => {
    // r32-11 = [Winner Group A, Best 3rd #5]. "Winner Group A" uniquely identifies it.
    const fixture = placeholderMatch('of-1', 'round_of_32', 'Winner Group A', '3rd Group E');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-11')).toBe('of-1');
    // No other node is annotated.
    expect(result.filter((n) => n.id !== 'r32-11' && n.matchId != null)).toHaveLength(0);
  });

  it('maps a [Runner-up A, Runner-up B] fixture onto r32-3 (both labels agree)', () => {
    const fixture = placeholderMatch('of-2', 'round_of_32', 'Runner-up Group A', 'Runner-up Group B');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-3')).toBe('of-2');
  });

  it('ignores home/away orientation — swapped labels still hit the same node', () => {
    const fixture = placeholderMatch('of-3', 'round_of_32', '3rd Group F', 'Winner Group D');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [fixture]);
    expect(matchId(result, 'r32-7')).toBe('of-3'); // r32-7 = [Winner Group D, Best 3rd #3]
  });
});

// ---------------------------------------------------------------------------
// Slot identity from real teams (football-data-style), via group origin
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — real teams mapped by group origin', () => {
  it('maps USA (Group D) vs BIH (Group F) onto r32-7 = [Winner Group D, Best 3rd #3]', () => {
    // USA pins the "Winner Group D" slot; BIH (Group F) can only be the best-third
    // here — Group F's own winner node (r32-4) pairs with a runner-up, not a third,
    // so there is no rival interpretation. Unambiguous.
    const fixture = koMatch('fd-537421', 'round_of_32', 'USA', 'BIH');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-7')).toBe('fd-537421');
    expect(result.filter((n) => n.id !== 'r32-7' && n.matchId != null)).toHaveLength(0);
  });

  it('does NOT use chronology: a later-slot fixture with an EARLIER kickoff keeps its own slot', () => {
    // r32-8 (JPN/MAR) kicks off BEFORE r32-7 (USA/BIH). Positional/chronological
    // mapping would put the earlier-kickoff fixture in an earlier slot; identity must not.
    const r32_7 = koMatch('fd-7', 'round_of_32', 'USA', 'BIH', '2026-07-10T18:00:00Z');
    const r32_8 = koMatch('fd-8', 'round_of_32', 'JPN', 'MAR', '2026-07-01T18:00:00Z');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_7, r32_8]);
    expect(matchId(result, 'r32-7')).toBe('fd-7'); // r32-7 = [Winner D, Best 3rd #3]
    expect(matchId(result, 'r32-8')).toBe('fd-8'); // r32-8 = [Winner G, Best 3rd #4]
  });

  it('handles equal kickoff times within a round — each fixture lands on its own slot', () => {
    const sameTime = '2026-07-01T18:00:00Z';
    const r32_7 = koMatch('fd-a', 'round_of_32', 'USA', 'BIH', sameTime);
    const r32_8 = koMatch('fd-b', 'round_of_32', 'JPN', 'MAR', sameTime);
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_7, r32_8]);
    expect(matchId(result, 'r32-7')).toBe('fd-a');
    expect(matchId(result, 'r32-8')).toBe('fd-b');
  });

  it('partial publication: only later-slot fixtures published still map to their CORRECT slots', () => {
    // Earlier R32 slots (r32-1, r32-2, ...) are NOT published. The USA/BIH fixture
    // must still land on r32-7 (not get pulled forward to r32-1), and JPN/MAR on r32-8.
    const r32_7 = koMatch('fd-7', 'round_of_32', 'USA', 'BIH');
    const r32_8 = koMatch('fd-8', 'round_of_32', 'JPN', 'MAR');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32_7, r32_8]);
    expect(matchId(result, 'r32-7')).toBe('fd-7');
    expect(matchId(result, 'r32-8')).toBe('fd-8');
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
    //   r32-7 = [Winner D, Best 3rd #3]  -> USA=Winner D, CRO=best-third
    //   r32-1 = [Winner E, Best 3rd #1]  -> CRO=Winner E, USA=best-third
    // Cannot tell which without final standings, so neither node is annotated.
    const fixture = koMatch('fd-amb', 'round_of_32', 'USA', 'CRO');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-7')).toBeUndefined();
    expect(matchId(result, 'r32-1')).toBeUndefined();
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
// FIX standings-aware disambiguation (cross-group winner / best-third ambiguity)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — standings-aware disambiguation', () => {
  it('resolves cross-group winner/third ambiguity when standings are known', () => {
    // USA won Group D (rank 1); BIH finished 3rd in Group E (rank 3).
    // Fixture USA vs BIH structurally fits r32-7 [Winner D, Best 3rd #3]
    // AND r32-1 [Winner E, Best 3rd #1], but standings prove USA cannot be
    // a best-third and BIH cannot be a group winner -> only r32-7 survives.
    const groups: Match[] = [
      groupMatch('D', 'USA', 'DD'),
      groupMatch('E', 'BIH', 'BEL'),
    ];
    const standings: Standing[] = [
      standing('D', 'USA', 1), standing('D', 'DD', 2), standing('D', 'D3', 3),
      standing('E', 'BEL', 1), standing('E', 'E2', 2), standing('E', 'BIH', 3),
    ];
    const fixture = koMatch('fd-537421', 'round_of_32', 'USA', 'BIH');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...groups, fixture], standings);
    expect(matchId(result, 'r32-7')).toBe('fd-537421');
    expect(matchId(result, 'r32-1')).toBeUndefined();
    expect(result.filter((n) => n.matchId != null)).toHaveLength(1);
  });

  it('assigns multiple ambiguous fixtures correctly when standings are provided', () => {
    // Two fixtures that each have overlapping structural candidates without
    // standings. With standings the ambiguity collapses for both and they
    // resolve to distinct nodes.
    const groups: Match[] = [
      groupMatch('D', 'USA', 'DD'),
      groupMatch('E', 'BIH', 'BEL'),
      groupMatch('G', 'JPN', 'JJ'),
      groupMatch('I', 'MAR', 'HH'),
    ];
    const standings: Standing[] = [
      standing('D', 'USA', 1), standing('D', 'DD', 2), standing('D', 'D3', 3),
      standing('E', 'BEL', 1), standing('E', 'E2', 2), standing('E', 'BIH', 3),
      standing('G', 'JPN', 1), standing('G', 'JJ', 2), standing('G', 'G3', 3),
      standing('I', 'I1', 1), standing('I', 'I2', 2), standing('I', 'MAR', 3),
    ];
    const usaBih = koMatch('fd-537421', 'round_of_32', 'USA', 'BIH');
    const jpnMar = koMatch('fd-8', 'round_of_32', 'JPN', 'MAR');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...groups, usaBih, jpnMar], standings);
    expect(matchId(result, 'r32-7')).toBe('fd-537421');
    expect(matchId(result, 'r32-8')).toBe('fd-8');
    expect(result.filter((n) => n.matchId != null)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// FIX 1 — rank inversion is impossible (a real team pins a GROUP, never W vs R)
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — no rank-inverted annotation', () => {
  it('refuses a [group-D, group-G] fixture: cannot tell winner from runner-up', () => {
    // USA (Group D) vs GHA (Group G) structurally fits r32-7 [Winner D, ...],
    // r32-8 [Winner G, ...] and r32-14 [Runner-up D, Runner-up G]. The link to the
    // W-node and the R-node of BOTH groups is rank-agnostic -> refuse outright.
    const fixture = koMatch('fd-rank', 'round_of_32', 'USA', 'GHA');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(result.filter((n) => n.matchId != null)).toHaveLength(0);
  });

  it('does NOT fall back to the opposite-rank node even when the correct nodes are taken', () => {
    // Pre-claim r32-7 (Winner D) and r32-8 (Winner G) via overrides. A naive
    // "assign to the last remaining open candidate" would now strand USA/GHA onto
    // r32-14 [Runner-up D, Runner-up G] — a rank-inverted guess. It must not.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-7')!.matchId = 'override-7';
    skeleton.find((n) => n.id === 'r32-8')!.matchId = 'override-8';
    const fixture = koMatch('fd-rank', 'round_of_32', 'USA', 'GHA');
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, fixture]);
    expect(matchId(result, 'r32-14')).toBeUndefined();
    expect(result.some((n) => n.matchId === 'fd-rank')).toBe(false);
    // Overrides untouched.
    expect(matchId(result, 'r32-7')).toBe('override-7');
    expect(matchId(result, 'r32-8')).toBe('override-8');
  });

  it('still maps the unambiguous case (USA/BIH): rank is forced by structure, not guessed', () => {
    // USA can only be Winner D here (the Runner-up D node r32-14 needs a Group-G
    // partner, and BIH is Group F), so there is no rank ambiguity to refuse.
    const fixture = koMatch('fd-ok', 'round_of_32', 'USA', 'BIH');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, fixture]);
    expect(matchId(result, 'r32-7')).toBe('fd-ok');
  });
});

// ---------------------------------------------------------------------------
// FIX 2 — iterative elimination never drops a resolvable fixture
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — iterative, order-independent assignment', () => {
  // A mixed batch: two cleanly-resolvable fixtures, one cross-group-ambiguous,
  // one rank-ambiguous. The resolvable two must ALWAYS map; the other two never.
  // All fixtures use distinct teams (each nation plays one R32 match, as in reality).
  const resolvableA = koMatch('fd-7', 'round_of_32', 'USA', 'BIH'); // -> r32-7
  const resolvableB = koMatch('fd-8', 'round_of_32', 'JPN', 'MAR'); // -> r32-8
  const crossAmbiguous = koMatch('fd-amb', 'round_of_32', 'ITA', 'EGY'); // r32-11 or r32-16
  const rankAmbiguous = koMatch('fd-rank', 'round_of_32', 'SWE', 'NOR'); // [Group E, Group I] -> rank-poisoned

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
      expect(matchId(result, 'r32-7')).toBe('fd-7');
      expect(matchId(result, 'r32-8')).toBe('fd-8');
      // Nothing else is ever annotated.
      const annotated = result.filter((n) => n.matchId != null).map((n) => n.id).sort();
      expect(annotated).toEqual(['r32-7', 'r32-8']);
    }
  });

  it('an override consuming a slot does not strand or shift independent fixtures', () => {
    // r32-7 is pre-claimed by an override whose fixture is ABSENT. The override is
    // preserved, USA/BIH (which only fits the taken r32-7) is dropped via the
    // elimination loop, and the independent JPN/MAR still resolves to r32-8.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-7')!.matchId = 'manual-absent';
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, resolvableA, resolvableB]);
    expect(matchId(result, 'r32-7')).toBe('manual-absent');
    expect(matchId(result, 'r32-8')).toBe('fd-8');
    expect(result.some((n) => n.matchId === 'fd-7')).toBe(false);
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
    const r32 = koMatch('fd-7', 'round_of_32', 'USA', 'BIH'); // -> r32-7
    const final = koMatch('fd-final', 'final', 'USA', 'JPN');
    const third = koMatch('fd-third', 'third_place', 'BIH', 'MAR');
    const result = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, r32, final, third]);
    expect(matchId(result, 'final')).toBe('fd-final');
    expect(matchId(result, 'third-place')).toBe('fd-third');
    // Per-stage independence: the R32 mapping is unaffected.
    expect(matchId(result, 'r32-7')).toBe('fd-7');
  });
});

// ---------------------------------------------------------------------------
// Manual overrides / pre-set matchIds
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — manual overrides', () => {
  it('preserves a pre-set matchId and never overwrites it', () => {
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-7')!.matchId = 'manual-override';
    const fixture = koMatch('fd-7', 'round_of_32', 'USA', 'BIH'); // would otherwise hit r32-7
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, fixture]);
    expect(matchId(result, 'r32-7')).toBe('manual-override');
  });

  it('an override node whose fixture is ABSENT does not shift/misalign other fixtures', () => {
    // r32-7 is overridden to a fixture NOT present in `matches`. The published
    // USA/BIH fixture (which targets r32-7) must NOT steal another slot, and the
    // unrelated JPN/MAR fixture must still map to r32-8 correctly.
    const skeleton = buildKnockoutSkeleton();
    skeleton.find((n) => n.id === 'r32-7')!.matchId = 'manual-absent';
    const usaBih = koMatch('fd-7', 'round_of_32', 'USA', 'BIH'); // targets the taken r32-7
    const jpnMar = koMatch('fd-8', 'round_of_32', 'JPN', 'MAR'); // targets r32-8
    const result = mergeKnockoutFixtures(skeleton, [...GROUPS, usaBih, jpnMar]);

    expect(matchId(result, 'r32-7')).toBe('manual-absent'); // override preserved
    expect(matchId(result, 'r32-8')).toBe('fd-8'); // remaining fixture still correct
    // The displaced USA/BIH fixture was NOT mis-assigned to any other node.
    expect(result.some((n) => n.matchId === 'fd-7')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Non-mutation
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — purity', () => {
  it('does not mutate the original skeleton nodes', () => {
    const skeleton = buildKnockoutSkeleton();
    const origR32_7 = skeleton.find((n) => n.id === 'r32-7')!;
    mergeKnockoutFixtures(skeleton, [...GROUPS, koMatch('fd-7', 'round_of_32', 'USA', 'BIH')]);
    expect(origR32_7.matchId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Corrected FIFA 2026 R32 skeleton — exact pairing table + topology
//
// These regression tests pin the authoritative FoxSports / FIFA bracket. They
// FAIL against the previous (transposed) R32_PAIRINGS table and PASS with the fix.
// ---------------------------------------------------------------------------

describe('buildKnockoutSkeleton — authoritative R32 pairing table', () => {
  // node id -> [homeSource, awaySource] per the official 2026 bracket.
  const EXPECTED_R32: Record<string, [string, string]> = {
    'r32-1': ['Winner Group E', 'Best 3rd #1'],
    'r32-2': ['Winner Group I', 'Best 3rd #2'],
    'r32-3': ['Runner-up Group A', 'Runner-up Group B'],
    'r32-4': ['Winner Group F', 'Runner-up Group C'],
    'r32-5': ['Runner-up Group K', 'Runner-up Group L'],
    'r32-6': ['Winner Group H', 'Runner-up Group J'],
    'r32-7': ['Winner Group D', 'Best 3rd #3'],
    'r32-8': ['Winner Group G', 'Best 3rd #4'],
    'r32-9': ['Winner Group C', 'Runner-up Group F'],
    'r32-10': ['Runner-up Group E', 'Runner-up Group I'],
    'r32-11': ['Winner Group A', 'Best 3rd #5'],
    'r32-12': ['Winner Group L', 'Best 3rd #6'],
    'r32-13': ['Winner Group J', 'Runner-up Group H'],
    'r32-14': ['Runner-up Group D', 'Runner-up Group G'],
    'r32-15': ['Winner Group B', 'Best 3rd #7'],
    'r32-16': ['Winner Group K', 'Best 3rd #8'],
  };

  it('emits every R32 node with the official home/away slot sources', () => {
    const byId = new Map(buildKnockoutSkeleton().map((n) => [n.id, n]));
    for (const [id, [home, away]] of Object.entries(EXPECTED_R32)) {
      const node = byId.get(id)!;
      expect([node.id, node.homeSource, node.awaySource]).toEqual([id, home, away]);
    }
  });

  it('uses each group winner, runner-up and best-third exactly once across the 32 R32 slots', () => {
    const slots = buildKnockoutSkeleton()
      .filter((n) => n.stage === 'round_of_32')
      .flatMap((n) => [n.homeSource, n.awaySource]);
    expect(slots).toHaveLength(32);
    const groups = 'ABCDEFGHIJKL'.split('');
    for (const g of groups) {
      expect(slots.filter((s) => s === `Winner Group ${g}`)).toHaveLength(1);
      expect(slots.filter((s) => s === `Runner-up Group ${g}`)).toHaveLength(1);
    }
    const thirds = slots.filter((s) => /^Best 3rd #\d+$/.test(s));
    expect(thirds).toHaveLength(8);
    expect(new Set(thirds).size).toBe(8); // #1..#8, no duplicates
  });

  it('wires the forward topology R32 -> R16 -> QF -> SF -> Final + third-place', () => {
    const nodes = buildKnockoutSkeleton();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // Each R32 winner feeds r16-ceil(n/2); each R16 node is fed by Winner R32-(2n-1)/(2n).
    for (let n = 1; n <= 16; n += 1) {
      expect(byId.get(`r32-${n}`)!.winnerFeedsTo).toBe(`r16-${Math.ceil(n / 2)}`);
    }
    for (let n = 1; n <= 8; n += 1) {
      const r16 = byId.get(`r16-${n}`)!;
      expect(r16.homeSource).toBe(`Winner R32-${2 * n - 1}`);
      expect(r16.awaySource).toBe(`Winner R32-${2 * n}`);
      expect(r16.winnerFeedsTo).toBe(`qf-${Math.ceil(n / 2)}`);
    }
    for (let n = 1; n <= 4; n += 1) {
      expect(byId.get(`qf-${n}`)!.winnerFeedsTo).toBe(`sf-${Math.ceil(n / 2)}`);
    }
    expect(byId.get('sf-1')!.winnerFeedsTo).toBe('final');
    expect(byId.get('sf-2')!.winnerFeedsTo).toBe('final');
    expect(byId.get('third-place')!.winnerFeedsTo).toBeUndefined();
    expect(byId.get('final')!.winnerFeedsTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Live cache integration — every published R32 fixture attaches to its node
//
// This is the core acceptance test: against the real football-data cache, all 16
// published R32 fixtures must map to exactly one node (zero dropped fixtures), and
// the marquee matchups must land on the officially-correct slots. Under the OLD
// (transposed) table 8 of these fixtures dropped, stranding the away R16 feeders.
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures — live cache (all 16 R32 fixtures attach)', () => {
  const cache = JSON.parse(
    readFileSync(new URL('../data/cache/dashboard.json', import.meta.url), 'utf8'),
  ) as { matches: Match[]; standings: Standing[] };
  const merged = mergeKnockoutFixtures(buildKnockoutSkeleton(), cache.matches, cache.standings);
  const byMatchId = new Map(cache.matches.map((m) => [m.id, m]));
  const r32Nodes = merged.filter((n: BracketNode) => n.stage === 'round_of_32');

  function teamsAt(nodeId: string): Set<string> {
    const node = merged.find((n: BracketNode) => n.id === nodeId)!;
    const m = node.matchId ? byMatchId.get(node.matchId) : undefined;
    return m ? new Set([m.homeTeam.id, m.awayTeam.id]) : new Set();
  }

  it('attaches a matchId to ALL 16 R32 nodes (no fixture dropped)', () => {
    const dropped = r32Nodes.filter((n) => !n.matchId).map((n) => n.id);
    expect(dropped).toEqual([]);
    expect(r32Nodes.filter((n) => n.matchId)).toHaveLength(16);
    // Each published R32 fixture is used exactly once (no double-assignment).
    const usedIds = r32Nodes.map((n) => n.matchId);
    expect(new Set(usedIds).size).toBe(16);
  });

  it('lands the marquee matchups on their officially-correct nodes', () => {
    expect(teamsAt('r32-7')).toEqual(new Set(['USA', 'BIH'])); // Winner D vs Best 3rd
    expect(teamsAt('r32-9')).toEqual(new Set(['BRA', 'JPN'])); // Winner C vs Runner-up F
    expect(teamsAt('r32-3')).toEqual(new Set(['RSA', 'CAN'])); // Runner-up A vs Runner-up B
    expect(teamsAt('r32-1')).toEqual(new Set(['GER', 'PAR'])); // Winner E vs Best 3rd
    expect(teamsAt('r32-15')).toEqual(new Set(['SUI', 'ALG'])); // Winner B vs Best 3rd
  });

  it('preserves correct winner-feed topology for every attached R32 node', () => {
    for (const node of r32Nodes) {
      const n = Number(node.id.slice('r32-'.length));
      expect(node.winnerFeedsTo).toBe(`r16-${Math.ceil(n / 2)}`);
    }
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
    // football-data names USA vs BIH on the r32-7 fixture while Group D is still in
    // progress. Identity mapping pins it to r32-7; the resolver shows both teams.
    const usaBih: Match = {
      id: 'fd-537421',
      stage: 'round_of_32',
      homeTeam: team('USA', 'United States'),
      awayTeam: team('BIH', 'Bosnia-Herzegovina'),
      kickoffUtc: '2026-07-01T20:00:00Z',
      status: 'scheduled',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...GROUPS, usaBih]);
    expect(matchId(augmented, 'r32-7')).toBe('fd-537421');

    // Groups are NOT decided (group fixtures are still 'scheduled'), so the resolver
    // must lean on the matchId, not standings.
    const resolved = resolveBracket([...GROUPS, usaBih], [], augmented);
    const r32_7 = resolved.find((n) => n.id === 'r32-7')!;
    expect(r32_7.matchId).toBe('fd-537421');
    expect(r32_7.home.team?.id).toBe('USA');
    expect(r32_7.away.team?.id).toBe('BIH');
    expect(r32_7.decided).toBe(true);
  });

  it('(regression) standings-aware merge prevents USA-vs-third misrender', () => {
    // Scenario: USA won Group D, BIH finished 3rd in Group E. The published
    // fixture is USA vs BIH (fd-537421). Without standings awareness the merge
    // sees structural ambiguity with r32-1 and may drop the fixture, leaving
    // r32-7 without a matchId. The resolver then backfills Best 3rd #3 with the
    // top-ranked third (here, SWE). With standings the ambiguity collapses and
    // the fixture keeps its matchId -> resolver shows BIH.
    const groupMatches: Match[] = [
      // Group D decided: USA winner
      { id: 'gd1', stage: 'group', group: 'D', homeTeam: team('USA'), awayTeam: team('DD'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 0, winnerTeamId: 'USA' },
      { id: 'gd2', stage: 'group', group: 'D', homeTeam: team('D3'), awayTeam: team('D4'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'D3' },
      // Group E decided: BIH 3rd
      { id: 'ge1', stage: 'group', group: 'E', homeTeam: team('BEL'), awayTeam: team('E2'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 1, winnerTeamId: 'BEL' },
      { id: 'ge2', stage: 'group', group: 'E', homeTeam: team('BIH'), awayTeam: team('E4'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'BIH' },
      // Group H decided: SWE 3rd (strong points so it would be the top Best-3rd)
      { id: 'gh1', stage: 'group', group: 'H', homeTeam: team('MAR'), awayTeam: team('HH'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 0, winnerTeamId: 'MAR' },
      { id: 'gh2', stage: 'group', group: 'H', homeTeam: team('SWE'), awayTeam: team('H4'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'SWE' },
    ];
    const standings: Standing[] = [
      standing('D', 'USA', 1), standing('D', 'DD', 2), standing('D', 'D3', 3),
      standing('E', 'BEL', 1), standing('E', 'E2', 2), standing('E', 'BIH', 3),
      standing('H', 'MAR', 1), standing('H', 'HH', 2), standing('H', 'SWE', 3),
    ];
    const usaBih: Match = {
      id: 'fd-537421',
      stage: 'round_of_32',
      homeTeam: team('USA', 'United States'),
      awayTeam: team('BIH', 'Bosnia-Herzegovina'),
      kickoffUtc: '2026-07-01T20:00:00Z',
      status: 'scheduled',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...groupMatches, usaBih], standings);
    expect(matchId(augmented, 'r32-7')).toBe('fd-537421');

    const resolved = resolveBracket([...groupMatches, usaBih], standings, augmented);
    const r32_7 = resolved.find((n) => n.id === 'r32-7')!;
    expect(r32_7.matchId).toBe('fd-537421');
    expect(r32_7.home.team?.id).toBe('USA');
    expect(r32_7.away.team?.id).toBe('BIH');
    expect(r32_7.away.team?.id).not.toBe('SWE');
    expect(r32_7.decided).toBe(true);
  });

  it('(b) a placeholder/TBD slot keeps its synthesized label (no wrong override)', () => {
    // Group A decided -> Winner A = AAA from standings. An unannotated r32-11 keeps
    // the group-derived team on the home slot and the placeholder on the third slot.
    const groupMatches: Match[] = [
      { id: 'g1', stage: 'group', group: 'A', homeTeam: team('AAA'), awayTeam: team('BBB'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 0, winnerTeamId: 'AAA' },
      { id: 'g2', stage: 'group', group: 'A', homeTeam: team('CCC'), awayTeam: team('DDD'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'CCC' },
    ];
    const standings = [standing('A', 'AAA', 1), standing('A', 'CCC', 2)];

    // A TBD fixture carries no identity -> r32-11 is left unannotated (fail safe).
    const tbdFixture: Match = {
      id: 'fd-tbd-1',
      stage: 'round_of_32',
      homeTeam: { id: 'TBD', name: 'TBD' },
      awayTeam: { id: 'TBD2', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...groupMatches, tbdFixture]);
    expect(matchId(augmented, 'r32-11')).toBeUndefined();

    const resolved = resolveBracket([...groupMatches, tbdFixture], standings, augmented);
    const r32_11 = resolved.find((n) => n.id === 'r32-11')!;
    expect(r32_11.home.team?.id).toBe('AAA'); // Winner Group A from standings
    expect(r32_11.away.team).toBeUndefined(); // Best 3rd #5 not yet known
    expect(r32_11.home.source).toBe('Winner Group A');
    expect(r32_11.away.source).toBe('Best 3rd #5');
    expect(r32_11.decided).toBe(false);
  });

  it('(c) propagates the winner of a fixture-mapped node into the next round', () => {
    // USA beat BIH in r32-7; the winner should flow into r16-4 (fed by Winner R32-7).
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
    expect(matchId(augmented, 'r32-7')).toBe('fd-001');

    const resolved = resolveBracket([...GROUPS, usaBih], [], augmented);
    const r32_7 = resolved.find((n) => n.id === 'r32-7')!;
    expect(r32_7.winner?.id).toBe('USA');
    expect(r32_7.home.isWinner).toBe(true);
    expect(r32_7.home.score).toBe(2);

    // r16-4 home source = "Winner R32-7" -> receives USA via propagation.
    const r16_4 = resolved.find((n) => n.id === 'r16-4')!;
    expect(r16_4.home.team?.id).toBe('USA');
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
