import type { BracketNode, Match, Stage } from '../../shared/types.js';

// The static 48-team 2026 World Cup knockout skeleton (spec §6).
//
// 32 teams reach the Round of 32: the 12 group winners, the 12 runners-up, and
// the 8 best third-placed teams. From there it's a straight single-elimination
// bracket: R32 (16) -> R16 (8) -> QF (4) -> SF (2) -> Final, plus a third-place
// playoff between the two semifinal losers.
//
// Slot sources use the labels the resolver understands:
//   "Winner Group A" / "Runner-up Group B" / "Best 3rd #1" for the R32 feed,
//   "Winner R32-1" / "Winner QF-2" for knockout feeds, "Loser SF-1" for third.
// `winnerFeedsTo` records the forward edge the resolver propagates winners along.
//
// This is the single source of truth for the skeleton: the remote providers call
// it, and data/manual/bracket.json mirrors its output. Keep them in sync.

// The 16 Round-of-32 pairings. Each group winner (1x), runner-up (1x) and the 8
// best thirds (1x) appears exactly once across the 32 slots.
const R32_PAIRINGS: ReadonlyArray<readonly [string, string]> = [
  ['Winner Group A', 'Best 3rd #1'],
  ['Runner-up Group B', 'Runner-up Group C'],
  ['Winner Group D', 'Best 3rd #2'],
  ['Winner Group F', 'Runner-up Group E'],
  ['Winner Group G', 'Best 3rd #3'],
  ['Runner-up Group H', 'Runner-up Group I'],
  ['Winner Group J', 'Best 3rd #4'],
  ['Winner Group L', 'Runner-up Group K'],
  ['Winner Group B', 'Best 3rd #5'],
  ['Runner-up Group A', 'Runner-up Group D'],
  ['Winner Group E', 'Best 3rd #6'],
  ['Winner Group H', 'Runner-up Group G'],
  ['Winner Group I', 'Best 3rd #7'],
  ['Runner-up Group J', 'Runner-up Group L'],
  ['Winner Group K', 'Best 3rd #8'],
  ['Winner Group C', 'Runner-up Group F'],
];

export function buildKnockoutSkeleton(): BracketNode[] {
  const nodes: BracketNode[] = [];

  // Round of 32 — 16 matches feeding the 8 Round-of-16 matches in pairs.
  R32_PAIRINGS.forEach(([home, away], i) => {
    const n = i + 1;
    nodes.push({
      id: `r32-${n}`,
      stage: 'round_of_32',
      label: `Round of 32 · Match ${n}`,
      homeSource: home,
      awaySource: away,
      winnerFeedsTo: `r16-${Math.ceil(n / 2)}`,
    });
  });

  // Round of 16 — 8 matches.
  for (let n = 1; n <= 8; n += 1) {
    nodes.push({
      id: `r16-${n}`,
      stage: 'round_of_16',
      label: `Round of 16 · Match ${n}`,
      homeSource: `Winner R32-${2 * n - 1}`,
      awaySource: `Winner R32-${2 * n}`,
      winnerFeedsTo: `qf-${Math.ceil(n / 2)}`,
    });
  }

  // Quarterfinals — 4 matches.
  for (let n = 1; n <= 4; n += 1) {
    nodes.push({
      id: `qf-${n}`,
      stage: 'quarterfinal',
      label: `Quarterfinal ${n}`,
      homeSource: `Winner R16-${2 * n - 1}`,
      awaySource: `Winner R16-${2 * n}`,
      winnerFeedsTo: `sf-${Math.ceil(n / 2)}`,
    });
  }

  // Semifinals — 2 matches.
  for (let n = 1; n <= 2; n += 1) {
    nodes.push({
      id: `sf-${n}`,
      stage: 'semifinal',
      label: `Semifinal ${n}`,
      homeSource: `Winner QF-${2 * n - 1}`,
      awaySource: `Winner QF-${2 * n}`,
      winnerFeedsTo: 'final',
    });
  }

  // Third-place playoff between the two semifinal losers.
  nodes.push({
    id: 'third-place',
    stage: 'third_place',
    label: 'Third-place Playoff',
    homeSource: 'Loser SF-1',
    awaySource: 'Loser SF-2',
  });

  // Final.
  nodes.push({
    id: 'final',
    stage: 'final',
    label: 'Final',
    homeSource: 'Winner SF-1',
    awaySource: 'Winner SF-2',
  });

  return nodes;
}

// Knockout rounds in the order they appear in the bracket. We process them in
// this sequence so the positional mapping below applies within each round.
const KNOCKOUT_STAGE_ORDER: Stage[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final',
];

/**
 * Annotate the bracket skeleton with `matchId`s derived from the published
 * fixture list (spec §6 — fixture-driven matchups).
 *
 * For each knockout round, the published fixtures are sorted by kickoff time
 * (with the match id as a stable tiebreaker for same-day games) and mapped
 * positionally to the skeleton nodes in that round. This relies on one
 * assumption: the tournament plays each round's matches in bracket-slot order,
 * which is how FIFA schedules single-elimination knockout rounds. The football-
 * data.org API returns matches in this order; OpenFootball preserves the same
 * schedule ordering.
 *
 * Effect on `resolveBracket`: once a node carries a `matchId`, the resolver
 * finds the linked match by ID (bypassing the team-matching fallback). If the
 * fixture already names both real, non-placeholder teams — as football-data
 * does for R32 fixtures even during the group stage — the resolver populates
 * those teams into the bracket slots immediately, without waiting for all
 * group standings to resolve. TBD/placeholder teams in the fixture are ignored
 * by the resolver, so group-derived placeholders are kept for those slots.
 *
 * Nodes that already carry a `matchId` (e.g. set by `applyManualOverrides`)
 * are left untouched so manual data always wins.
 */
export function mergeKnockoutFixtures(nodes: BracketNode[], matches: Match[]): BracketNode[] {
  // Build a per-stage list of published fixtures in kickoff order.
  const fixturesByStage = new Map<Stage, Match[]>();
  for (const stage of KNOCKOUT_STAGE_ORDER) {
    const stageMatches = matches
      .filter((m) => m.stage === stage)
      .sort((a, b) => {
        const timeDiff =
          new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
        return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
      });
    fixturesByStage.set(stage, stageMatches);
  }

  // Shallow-copy the nodes so the caller's skeleton is not mutated.
  const result = nodes.map((n) => ({ ...n }));

  for (const stage of KNOCKOUT_STAGE_ORDER) {
    const fixtures = fixturesByStage.get(stage) ?? [];
    const stageNodes = result.filter((n) => n.stage === stage);
    // Positional mapping: fixture[i] corresponds to skeleton node[i].
    for (let i = 0; i < Math.min(fixtures.length, stageNodes.length); i++) {
      const node = stageNodes[i];
      const fixture = fixtures[i];
      // Respect any matchId already set (e.g. by manual overrides).
      if (!node.matchId) {
        node.matchId = fixture.id;
      }
    }
  }

  return result;
}
