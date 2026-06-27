// Stage-windowed knockout view (spec §6). The knockout area shows a SLIDING
// WINDOW of at most two adjacent rounds, advancing through the tournament as
// rounds complete. These are pure, clock-independent predicates over the resolved
// bracket, so they live in `shared` and the client can recompute them every render
// alongside selectDashboardState / resolveBracket.

import type { ResolvedBracketNode, Stage } from './types.js';

// The knockout rounds in ascending order. `third_place` is intentionally absent:
// it is a single consolation match, not part of the championship path the window
// advances along (R32 -> R16 -> QF -> SF -> Final).
export const KNOCKOUT_ROUND_ORDER: Stage[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'final',
];

// --- per-round predicates --------------------------------------------------
// Each operates on the set of bracket nodes belonging to a single round.

// Every match in the round has BOTH slots resolved to real teams (no
// "Winner Group X" / "Winner R32-1" placeholders left). A node's `decided` flag is
// exactly "both slots resolved", so the round's pairings are set iff all decided.
export function roundPairingsSet(nodes: ResolvedBracketNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => n.decided);
}

// At least one match in the round has a winner/result.
export function roundStarted(nodes: ResolvedBracketNode[]): boolean {
  return nodes.some((n) => n.winner != null);
}

// Every match in the round has a winner.
export function roundComplete(nodes: ResolvedBracketNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => n.winner != null);
}

// Group a resolved bracket by round, in ascending knockout order, dropping rounds
// the skeleton doesn't contain.
function roundsInOrder(
  bracket: ResolvedBracketNode[],
): { stage: Stage; nodes: ResolvedBracketNode[] }[] {
  return KNOCKOUT_ROUND_ORDER.map((stage) => ({
    stage,
    nodes: bracket.filter((n) => n.stage === stage),
  })).filter((r) => r.nodes.length > 0);
}

// The sliding window: at most TWO adjacent knockout rounds to render, left -> right
// in ascending round order (spec §6).
//   - current = the lowest-ordered round that is NOT complete (if all rounds are
//     complete, current = the Final). Always shown, on the LEFT.
//   - next = current + 1 (when it exists) is ALSO shown — on the RIGHT — once
//     current has started (>= 1 winner), so it begins populating as current finishes.
//   - current is implicitly dropped once it becomes complete (the not-complete
//     search then lands on next), so the window slides forward one round at a time:
//     [R32] -> [R32, R16] -> [R16] -> [R16, QF] -> ... -> [SF, Final] -> [Final].
export function selectKnockoutWindow(bracket: ResolvedBracketNode[]): Stage[] {
  const rounds = roundsInOrder(bracket);
  if (rounds.length === 0) return [];

  let currentIdx = rounds.findIndex((r) => !roundComplete(r.nodes));
  if (currentIdx === -1) currentIdx = rounds.length - 1; // all complete -> Final

  const window: Stage[] = [rounds[currentIdx].stage];
  const next = rounds[currentIdx + 1];
  if (next && roundStarted(rounds[currentIdx].nodes)) {
    window.push(next.stage);
  }
  return window;
}
