import type { BracketNode, Match, Stage, Standing, TeamRef } from '../../shared/types.js';

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

const KNOCKOUT_STAGES: ReadonlySet<Stage> = new Set<Stage>([
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final',
]);

// --- slot-identity grammar -------------------------------------------------
//
// The mapping below keys off *slot identity*, never chronology. The only slot
// labels that are globally unique across the skeleton are the group ones:
// "Winner Group X" and "Runner-up Group X" each appear on exactly one node.
// "Best 3rd #N" thirds are a cross-group pool with no fixed group, and
// "Winner R32-n" feeds are resolved by winner propagation — so neither is a
// stable per-node key and both are treated as wildcards.
const WINNER_GROUP_RE = /^winner\s+group\s+([a-z])$/i;
const RUNNERUP_GROUP_RE = /^runner-?up\s+group\s+([a-z])$/i;
const BEST_THIRD_RE = /^best\s+3rd\s*#?\s*\d+$/i;
const THIRD_GROUP_RE = /^3rd\s+group\s+([a-z])$/i;
// A team name that reads like a source label rather than a real nation.
const PLACEHOLDER_RE = /^(winner|runner-?up|loser|best|3rd|tbd|to be)/i;

// What a skeleton node's source slot demands.
type SlotSpec =
  | { kind: 'group'; rank: 'W' | 'R'; group: string }
  | { kind: 'third' }
  | { kind: 'feed' };

function parseSource(source: string): SlotSpec {
  let m = source.match(WINNER_GROUP_RE);
  if (m) return { kind: 'group', rank: 'W', group: m[1].toUpperCase() };
  m = source.match(RUNNERUP_GROUP_RE);
  if (m) return { kind: 'group', rank: 'R', group: m[1].toUpperCase() };
  if (BEST_THIRD_RE.test(source)) return { kind: 'third' };
  return { kind: 'feed' }; // "Winner R32-1" / "Loser SF-1" etc.
}

// What a fixture's team side can prove about its bracket origin.
type SideProv =
  | { kind: 'group'; rank: 'W' | 'R'; group: string } // "Winner/Runner-up Group X" placeholder
  | { kind: 'third'; group: string } // "3rd Group X" placeholder
  | { kind: 'team'; group: string; teamId: string } // real nation, with its group-stage group known
  | { kind: 'unknown' }; // TBD / feed placeholder / ungrouped team — carries no identity

function sideProvenance(team: TeamRef, teamGroup: Map<string, string>): SideProv {
  const name = team.name.trim();
  let m = name.match(WINNER_GROUP_RE);
  if (m) return { kind: 'group', rank: 'W', group: m[1].toUpperCase() };
  m = name.match(RUNNERUP_GROUP_RE);
  if (m) return { kind: 'group', rank: 'R', group: m[1].toUpperCase() };
  m = name.match(THIRD_GROUP_RE);
  if (m) return { kind: 'third', group: m[1].toUpperCase() };
  // Other placeholders ("TBD", "Winner Match 74", "Loser Match 101") prove nothing.
  if (PLACEHOLDER_RE.test(name)) return { kind: 'unknown' };
  // A real nation: its origin is the group it played its group-stage games in.
  const group = teamGroup.get(team.id);
  return group ? { kind: 'team', group, teamId: team.id } : { kind: 'unknown' };
}

// Can a fixture side legitimately occupy a node's source slot?
function satisfies(side: SideProv, slot: SlotSpec, teamRank?: Map<string, number>): boolean {
  switch (slot.kind) {
    case 'group': {
      // A specific "Winner/Runner-up Group X" slot: an exact placeholder match,
      // or a real team from that group. If standings are known we enforce the
      // team's actual rank (1 = winner, 2 = runner-up) to disambiguate.
      if (side.kind === 'group') return side.rank === slot.rank && side.group === slot.group;
      if (side.kind === 'team') {
        if (side.group !== slot.group) return false;
        if (teamRank) {
          const rank = teamRank.get(side.teamId);
          if (rank != null) {
            const expected = slot.rank === 'W' ? 1 : 2;
            return rank === expected;
          }
        }
        return true;
      }
      return false;
    }
    case 'third': {
      // A best-third is some group's third-placed team. If standings are known
      // we restrict real teams to those actually ranked 3rd.
      if (side.kind === 'team') {
        if (teamRank) {
          const rank = teamRank.get(side.teamId);
          if (rank != null) return rank === 3;
        }
        return true;
      }
      return side.kind === 'third';
    }
    case 'feed':
      // Feeds ("Winner R32-1") resolve by propagation and can't be keyed here, so
      // only a real team or an opaque placeholder may sit in one.
      return side.kind === 'team' || side.kind === 'unknown';
  }
}

// Does this fixture fit this node in either home/away orientation? The bracket is
// agnostic to which provider lists home vs away, so we accept either.
function fixtureFitsNode(home: SideProv, away: SideProv, node: BracketNode, teamRank?: Map<string, number>): boolean {
  const h = parseSource(node.homeSource);
  const a = parseSource(node.awaySource);
  return (
    (satisfies(home, h, teamRank) && satisfies(away, a, teamRank)) ||
    (satisfies(home, a, teamRank) && satisfies(away, h, teamRank))
  );
}

// The group-W / group-R slots a node exposes (a node like [Runner-up A, Runner-up D]
// exposes two runner groups; [Winner F, Runner-up E] exposes one of each).
function nodeGroupRanks(node: BracketNode): { winners: string[]; runners: string[] } {
  const winners: string[] = [];
  const runners: string[] = [];
  for (const src of [node.homeSource, node.awaySource]) {
    const s = parseSource(src);
    if (s.kind === 'group') (s.rank === 'W' ? winners : runners).push(s.group);
  }
  return { winners, runners };
}

// FIX 1 — rank-inversion guard. A real team is trusted to pin its *group*, never
// to pick winner-vs-runner-up. If a fixture's full (taken-agnostic) candidate set
// contains both the Winner-of-G node and the Runner-up-of-G node for some group G,
// then the only thing linking the fixture to those nodes is a rank-agnostic real
// team — choosing one would be guessing rank. Such a fixture is refused entirely,
// so no later elimination of the "correct" node can strand it on the opposite-rank
// sibling. (Exact "Winner/Runner-up Group X" placeholders carry their own rank and
// never produce such a pair, so this only ever fires on real-team ambiguity.)
function hasRankSiblingPair(candidateNodes: BracketNode[]): boolean {
  const winnerGroups = new Set<string>();
  const runnerGroups = new Set<string>();
  for (const node of candidateNodes) {
    const gr = nodeGroupRanks(node);
    gr.winners.forEach((g) => winnerGroups.add(g));
    gr.runners.forEach((g) => runnerGroups.add(g));
  }
  for (const g of winnerGroups) if (runnerGroups.has(g)) return true;
  return false;
}

/**
 * Annotate the bracket skeleton with `matchId`s derived from published fixtures
 * (spec §6 — fixture-driven matchups), by *slot identity* — never by chronology.
 *
 * SCOPE (Option A — ship a safe core). Only the Round of 32 and the single-node
 * stages (Final, Third-place playoff) are mapped by `matchId` here. The Round of
 * 16, Quarterfinals and Semifinals are *intentionally* not matchId-mapped: their
 * slots are feeds ("Winner R32-1") that no provider keys reliably — football-data
 * publishes a bare TBD for an undecided knockout slot and exposes no predecessor
 * metadata — so there is nothing to map them by. Those rounds are resolved
 * downstream by `resolveBracket`: winners propagate forward along `winnerFeedsTo`,
 * and its team-pair fallback attaches each match once both teams are known. This
 * is a deliberate, tested design choice (see buildBracket.test.ts), not a gap.
 *
 * R32 identity comes from one of two places:
 *   - the fixture's placeholder slot labels — OpenFootball encodes them as
 *     "Winner Group A" / "Runner-up Group B" / "3rd Group C"; or
 *   - a real, named team's group origin — derived from the group-stage matches,
 *     so a knockout fixture that names actual nations (as football-data.org does)
 *     pins to the node referencing those groups. A real team pins a GROUP only,
 *     never a winner-vs-runner-up rank (see `hasRankSiblingPair`).
 *
 * The mapping is order-independent and therefore immune to the failure modes of
 * positional/chronological mapping: equal kickoff times, postponed/rescheduled
 * fixtures, and partial publication (only some of a round's fixtures present) all
 * map each fixture to its correct slot regardless.
 *
 * ALGORITHM — iterative constraint propagation, fail safe over guessing:
 *   1. For each knockout fixture compute its *full* structural candidate nodes
 *      (taken-agnostic), then drop the fixture if those candidates require a rank
 *      guess (FIX 1) or if none survive. The remaining candidates exclude nodes
 *      already carrying a `matchId` (manual overrides — never touched).
 *   2. Repeat to a fixed point: any fixture left with exactly one open candidate
 *      is assigned to it, and that node is removed from every other fixture's
 *      candidate set. This keeps assigning fixtures that only become uniquely
 *      identifiable after an earlier one is placed, instead of dropping them.
 *   3. Two fixtures forced onto the same node (a contradiction) are both dropped;
 *      anything still ambiguous (>1 candidate) is left unannotated. We never risk
 *      a wrong `matchId`.
 *
 * Relies on the skeleton's R32 group layout (R32_PAIRINGS) matching FIFA's real
 * bracket so that a named team's group identifies its node.
 */
export function mergeKnockoutFixtures(nodes: BracketNode[], matches: Match[], standings?: Standing[]): BracketNode[] {
  // Shallow-copy the nodes so the caller's skeleton is not mutated.
  const result = nodes.map((n) => ({ ...n }));
  const byId = new Map(result.map((n) => [n.id, n]));

  // team id -> group, from the group-stage fixtures (status-independent).
  const teamGroup = new Map<string, string>();
  for (const m of matches) {
    if (m.stage === 'group' && m.group) {
      teamGroup.set(m.homeTeam.id, m.group);
      teamGroup.set(m.awayTeam.id, m.group);
    }
  }

  // team id -> rank, from standings (when available) for disambiguation.
  const teamRank = new Map<string, number>();
  if (standings) {
    for (const s of standings) {
      teamRank.set(s.team.id, s.rank);
    }
  }

  // Step 1: build each fixture's open candidate set.
  const taken = new Set(result.filter((n) => n.matchId).map((n) => n.id));
  const candidates = new Map<string, Set<string>>(); // fixture id -> open node ids
  for (const fixture of matches) {
    if (!KNOCKOUT_STAGES.has(fixture.stage)) continue;
    const home = sideProvenance(fixture.homeTeam, teamGroup);
    const away = sideProvenance(fixture.awayTeam, teamGroup);
    // A fixture with no identifying side carries no slot identity at all.
    if (home.kind === 'unknown' && away.kind === 'unknown') continue;

    const full = result.filter((n) => n.stage === fixture.stage && fixtureFitsNode(home, away, n, teamRank));
    if (full.length === 0) continue;
    if (hasRankSiblingPair(full)) continue; // FIX 1: refuse rank guesses outright

    const open = new Set(full.filter((n) => !taken.has(n.id)).map((n) => n.id));
    if (open.size > 0) candidates.set(fixture.id, open);
  }

  // Step 2: iterative elimination to a fixed point.
  let progress = true;
  while (progress) {
    progress = false;

    // Collect fixtures forced to a single remaining candidate, grouped by node.
    const claimants = new Map<string, string[]>(); // node id -> forced fixture ids
    for (const [fixtureId, open] of candidates) {
      if (open.size !== 1) continue;
      const nodeId = [...open][0];
      const list = claimants.get(nodeId);
      if (list) list.push(fixtureId);
      else claimants.set(nodeId, [fixtureId]);
    }

    for (const [nodeId, fixtureIds] of claimants) {
      if (fixtureIds.length === 1) {
        const node = byId.get(nodeId);
        if (node && !node.matchId) node.matchId = fixtureIds[0];
        candidates.delete(fixtureIds[0]);
      } else {
        // Contradiction: two fixtures want the same slot -> drop both (fail safe).
        for (const fixtureId of fixtureIds) candidates.delete(fixtureId);
      }
      // The node is now consumed either way; free no fixture to grab it again.
      for (const open of candidates.values()) open.delete(nodeId);
      progress = true;
    }

    // Drop fixtures stranded with no remaining candidate (their slot was claimed).
    for (const [fixtureId, open] of [...candidates]) {
      if (open.size === 0) candidates.delete(fixtureId);
    }
  }

  return result;
}
