import type { BracketNode } from '../../shared/types.js';

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
