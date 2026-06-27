import { describe, it, expect } from 'vitest';
import { buildKnockoutSkeleton, mergeKnockoutFixtures } from '../src/server/normalize/buildBracket.js';
import { resolveBracket } from '../src/shared/resolveBracket.js';
import type { Match, Standing } from '../src/shared/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function team(id: string, name: string = id) {
  return { id, name };
}

function r32Match(id: string, homeId: string, awayId: string, kickoffUtc: string): Match {
  return {
    id,
    stage: 'round_of_32',
    homeTeam: team(homeId),
    awayTeam: team(awayId),
    kickoffUtc,
    status: 'scheduled',
  };
}

function standing(group: string, id: string, rank: number): Standing {
  return {
    group,
    team: team(id),
    played: 3, won: 1, drawn: 1, lost: 1,
    goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 4,
    rank,
  };
}

// ---------------------------------------------------------------------------
// mergeKnockoutFixtures — positional matchId annotation
// ---------------------------------------------------------------------------

describe('mergeKnockoutFixtures', () => {
  it('sets matchId on the first R32 node from the first (earliest) R32 fixture', () => {
    const skeleton = buildKnockoutSkeleton();
    const fixture = r32Match('fd-100', 'USA', 'MEX', '2026-07-01T18:00:00Z');
    const result = mergeKnockoutFixtures(skeleton, [fixture]);
    // r32-1 is the first node; it should now carry the fixture's id.
    const r32_1 = result.find((n) => n.id === 'r32-1')!;
    expect(r32_1.matchId).toBe('fd-100');
    // Other nodes must NOT have a matchId (no fixtures for them).
    expect(result.filter((n) => n.id !== 'r32-1' && n.matchId != null)).toHaveLength(0);
  });

  it('maps multiple R32 fixtures to nodes in kickoff order (earliest → r32-1, next → r32-2)', () => {
    const skeleton = buildKnockoutSkeleton();
    // Two fixtures; fd-200 kicks off earlier, so it should be r32-1.
    const fixtures = [
      r32Match('fd-201', 'GER', 'FRA', '2026-07-02T18:00:00Z'),
      r32Match('fd-200', 'USA', 'BIH', '2026-07-01T18:00:00Z'),
    ];
    const result = mergeKnockoutFixtures(skeleton, fixtures);
    expect(result.find((n) => n.id === 'r32-1')!.matchId).toBe('fd-200');
    expect(result.find((n) => n.id === 'r32-2')!.matchId).toBe('fd-201');
  });

  it('does not overwrite a matchId already set on a node', () => {
    const skeleton = buildKnockoutSkeleton();
    skeleton[0].matchId = 'manual-override';          // r32-1
    const fixture = r32Match('fd-100', 'USA', 'BIH', '2026-07-01T18:00:00Z');
    const result = mergeKnockoutFixtures(skeleton, [fixture]);
    expect(result.find((n) => n.id === 'r32-1')!.matchId).toBe('manual-override');
  });

  it('does not mutate the original skeleton nodes', () => {
    const skeleton = buildKnockoutSkeleton();
    const origFirst = skeleton[0];
    const fixture = r32Match('fd-100', 'USA', 'BIH', '2026-07-01T18:00:00Z');
    mergeKnockoutFixtures(skeleton, [fixture]);
    // Skeleton's first node must be unchanged.
    expect(origFirst.matchId).toBeUndefined();
  });

  it('maps R16 fixtures positionally when present', () => {
    const skeleton = buildKnockoutSkeleton();
    const r16Fixture: Match = {
      id: 'fd-300',
      stage: 'round_of_16',
      homeTeam: team('USA'),
      awayTeam: team('GER'),
      kickoffUtc: '2026-07-15T18:00:00Z',
      status: 'scheduled',
    };
    const result = mergeKnockoutFixtures(skeleton, [r16Fixture]);
    expect(result.find((n) => n.id === 'r16-1')!.matchId).toBe('fd-300');
    // R32 nodes must have no matchId (no R32 fixtures provided).
    expect(result.filter((n) => n.stage === 'round_of_32' && n.matchId != null)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (a) Fixture-named slot resolves to real teams + matchId in resolveBracket
// ---------------------------------------------------------------------------

describe('fixture-driven bracket — (a) real teams from published fixture', () => {
  it('populates real teams and matchId on a bracket node whose fixture names both teams', () => {
    // Simulate: football-data publishes R32 fixture 3 (r32-3: Winner D vs Best 3rd #2)
    // as "USA vs Bosnia" before the group stage ends.
    const usaBihFixture: Match = {
      id: 'fd-537421',
      stage: 'round_of_32',
      homeTeam: team('USA', 'United States'),
      awayTeam: team('BIH', 'Bosnia-Herzegovina'),
      kickoffUtc: '2026-07-01T20:00:00Z',
      status: 'scheduled',
    };

    // Two earlier R32 fixtures to push usaBihFixture to position 3 (r32-3).
    const earlier1 = r32Match('fd-537419', 'MEX', 'CAN', '2026-06-29T18:00:00Z');
    const earlier2 = r32Match('fd-537420', 'BRA', 'ARG', '2026-06-30T18:00:00Z');

    const allFixtures = [earlier1, earlier2, usaBihFixture];
    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), allFixtures);

    // r32-3 should be annotated with the USA vs BIH fixture.
    const r32_3node = augmented.find((n) => n.id === 'r32-3')!;
    expect(r32_3node.matchId).toBe('fd-537421');

    // Groups are NOT yet decided — pass no group matches and no standings.
    // Even without group resolution, resolveBracket should pull USA and BIH
    // from the fixture because both are non-placeholder teams.
    const resolved = resolveBracket([usaBihFixture, earlier1, earlier2], [], augmented);

    const r32_3 = resolved.find((n) => n.id === 'r32-3')!;
    expect(r32_3.matchId).toBe('fd-537421');
    expect(r32_3.home.team?.id).toBe('USA');
    expect(r32_3.away.team?.id).toBe('BIH');
    expect(r32_3.decided).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (b) TBD slot falls back to synthesized placeholder
// ---------------------------------------------------------------------------

describe('fixture-driven bracket — (b) TBD fixture keeps synthesized placeholder', () => {
  it('does not override a resolved group slot with a TBD team from the fixture', () => {
    // Group A is decided; Winner Group A = AAA.
    const groupMatches: Match[] = [
      { id: 'g1', stage: 'group', group: 'A', homeTeam: team('AAA'), awayTeam: team('BBB'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 2, awayScore: 0, winnerTeamId: 'AAA' },
      { id: 'g2', stage: 'group', group: 'A', homeTeam: team('CCC'), awayTeam: team('DDD'), kickoffUtc: '2026-06-11T19:00:00Z', status: 'finished', homeScore: 1, awayScore: 0, winnerTeamId: 'CCC' },
    ];
    const standings = [standing('A', 'AAA', 1), standing('A', 'CCC', 2)];

    // The R32 fixture for r32-1 has TBD for both sides.
    const tbdFixture: Match = {
      id: 'fd-tbd-1',
      stage: 'round_of_32',
      homeTeam: { id: 'TBD', name: 'TBD' },
      awayTeam: { id: 'TBD2', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };

    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [tbdFixture]);
    // r32-1 has the TBD fixture as matchId.
    expect(augmented.find((n) => n.id === 'r32-1')!.matchId).toBe('fd-tbd-1');

    const resolved = resolveBracket([...groupMatches, tbdFixture], standings, augmented);

    const r32_1 = resolved.find((n) => n.id === 'r32-1')!;
    // TBD teams from the fixture must NOT override the group-resolved team.
    expect(r32_1.home.team?.id).toBe('AAA'); // Winner Group A from standings
    // Away slot: still 'Best 3rd #1', not resolved (no cross-group ranking yet).
    expect(r32_1.away.team).toBeUndefined();
    expect(r32_1.decided).toBe(false);
  });

  it('leaves both slots as placeholders when the fixture has TBD teams and the group is not yet decided', () => {
    const tbdFixture: Match = {
      id: 'fd-tbd-2',
      stage: 'round_of_32',
      homeTeam: { id: 'TBD', name: 'TBD' },
      awayTeam: { id: 'TBD2', name: 'TBD' },
      kickoffUtc: '2026-07-01T18:00:00Z',
      status: 'scheduled',
    };

    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [tbdFixture]);
    const resolved = resolveBracket([tbdFixture], [], augmented);

    const r32_1 = resolved.find((n) => n.id === 'r32-1')!;
    expect(r32_1.home.team).toBeUndefined();
    expect(r32_1.away.team).toBeUndefined();
    expect(r32_1.decided).toBe(false);
    // Source labels (synthesized placeholders) are preserved.
    expect(r32_1.home.source).toBe('Winner Group A');
    expect(r32_1.away.source).toBe('Best 3rd #1');
  });
});

// ---------------------------------------------------------------------------
// (c) Winner propagation still advances a resolved winner
// ---------------------------------------------------------------------------

describe('fixture-driven bracket — (c) winner propagation after fixture resolution', () => {
  it('propagates the fixture winner into the next-round node', () => {
    // r32-1 (USA vs BIH) and r32-2 (GER vs FRA) both have real teams.
    // USA wins r32-1; GER wins r32-2.  The winner of each should appear in r16-1.
    const r32_1Fixture: Match = {
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
    const r32_2Fixture: Match = {
      id: 'fd-002',
      stage: 'round_of_32',
      homeTeam: team('GER', 'Germany'),
      awayTeam: team('FRA', 'France'),
      kickoffUtc: '2026-07-02T18:00:00Z',
      status: 'finished',
      homeScore: 1,
      awayScore: 0,
      winnerTeamId: 'GER',
    };

    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [r32_1Fixture, r32_2Fixture]);

    // r32-1 and r32-2 annotated; r16-1 gets its teams from winner propagation.
    const resolved = resolveBracket([r32_1Fixture, r32_2Fixture], [], augmented);

    const r32_1 = resolved.find((n) => n.id === 'r32-1')!;
    expect(r32_1.winner?.id).toBe('USA');
    expect(r32_1.home.isWinner).toBe(true);
    expect(r32_1.home.score).toBe(2);
    expect(r32_1.away.score).toBe(0);

    const r32_2 = resolved.find((n) => n.id === 'r32-2')!;
    expect(r32_2.winner?.id).toBe('GER');

    // r16-1 is fed by r32-1 (home) and r32-2 (away) via winnerFeedsTo.
    const r16_1 = resolved.find((n) => n.id === 'r16-1')!;
    expect(r16_1.home.team?.id).toBe('USA');
    expect(r16_1.away.team?.id).toBe('GER');
    expect(r16_1.decided).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (d) Mapping works across R32 and an R16 round
// ---------------------------------------------------------------------------

describe('fixture-driven bracket — (d) mapping across R32 and R16', () => {
  it('annotates R32 and R16 nodes independently and resolves both rounds', () => {
    // 16 R32 fixtures — give them sequential kickoffs so the ordering is deterministic.
    const r32Fixtures: Match[] = Array.from({ length: 16 }, (_, i) => ({
      id: `fd-r32-${i + 1}`,
      stage: 'round_of_32' as const,
      homeTeam: team(`H${i + 1}`),
      awayTeam: team(`A${i + 1}`),
      kickoffUtc: `2026-07-${String(i + 1).padStart(2, '0')}T18:00:00Z`,
      status: 'scheduled' as const,
    }));

    // One R16 fixture with real teams (teams from r32-1 / r32-2 outcomes).
    const r16Fixture: Match = {
      id: 'fd-r16-1',
      stage: 'round_of_16',
      homeTeam: team('H1', 'Team H1'),
      awayTeam: team('H2', 'Team H2'),
      kickoffUtc: '2026-07-20T18:00:00Z',
      status: 'scheduled',
    };

    const augmented = mergeKnockoutFixtures(buildKnockoutSkeleton(), [...r32Fixtures, r16Fixture]);

    // All 16 R32 nodes should be annotated.
    for (let i = 1; i <= 16; i++) {
      const node = augmented.find((n) => n.id === `r32-${i}`)!;
      expect(node.matchId).toBe(`fd-r32-${i}`);
    }

    // r16-1 should be annotated with the R16 fixture.
    expect(augmented.find((n) => n.id === 'r16-1')!.matchId).toBe('fd-r16-1');

    // Later R16 nodes must not carry a matchId (only one R16 fixture was provided).
    for (let i = 2; i <= 8; i++) {
      expect(augmented.find((n) => n.id === `r16-${i}`)!.matchId).toBeUndefined();
    }

    // resolveBracket: R16-1 should resolve H1 and H2 from the fixture directly.
    const resolved = resolveBracket([...r32Fixtures, r16Fixture], [], augmented);
    const r16_1 = resolved.find((n) => n.id === 'r16-1')!;
    expect(r16_1.matchId).toBe('fd-r16-1');
    expect(r16_1.home.team?.id).toBe('H1');
    expect(r16_1.away.team?.id).toBe('H2');
  });
});
