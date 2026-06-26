// Knockout bracket seeding/resolution engine (spec §6 / Phase 7).
//
// Pure and dependency-free so it can live in `shared` and be recomputed by the
// client every render (alongside selectDashboardState) — it depends only on the
// data payload (matches, standings, bracket skeleton), never on the wall clock.
//
// Given the static bracket skeleton (BracketNode[]) plus the current matches and
// group standings, it produces ResolvedBracketNode[] where each slot's source
// label ("Winner Group A", "Runner-up Group B", "Best 3rd #1", "Winner R32-1",
// "Loser SF-1") is resolved to a real team once it is known:
//
//  - Group slots resolve from standings, but only once that group is decided
//    (all of its group matches are finished) so a placeholder never flips to the
//    wrong nation mid-group. Group winner = rank 1, runner-up = rank 2.
//  - Best-third slots resolve only once *every* group match is finished (it is a
//    cross-group comparison). See `rankBestThirds` for the documented rule.
//  - Knockout slots ("Winner <node>" / "Loser <node>") resolve by propagating the
//    winner/loser of the referenced upstream node forward, driven by each node's
//    `winnerFeedsTo` edge, as knockout matches finish.
//
// Scores, status, kickoff and the winner of each node are pulled from the backing
// match — linked by `matchId`, or found by stage + the two resolved teams when no
// matchId is set (so a played knockout game attaches its score automatically).

import type {
  BracketNode,
  Match,
  ResolvedBracketNode,
  Standing,
  TeamRef,
} from './types.js';

const NUMBER_OF_BEST_THIRDS = 8;

// --- group helpers ---------------------------------------------------------

function groupIsDecided(group: string, matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === 'group' && m.group === group);
  if (groupMatches.length === 0) return false;
  return groupMatches.every((m) => m.status === 'finished');
}

function allGroupsDecided(matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === 'group');
  if (groupMatches.length === 0) return false;
  return groupMatches.every((m) => m.status === 'finished');
}

function standingFor(group: string, rank: number, standings: Standing[]): TeamRef | undefined {
  return standings.find((s) => s.group === group && s.rank === rank)?.team;
}

// Best-thirds rule (documented): of the 12 group third-placed teams, the 8 best
// advance. They are ranked by points, then goal difference, then goals scored,
// then fewest goals conceded, then team name (a deterministic stand-in for FIFA's
// fair-play / drawing-of-lots tiebreakers). The nth best fills "Best 3rd #n".
//
// Note this seeds thirds in pure ranking order rather than via FIFA's published
// group-combination table (which slot a given group's third lands in). The teams
// shown are correct; only their exact bracket placement is simplified — adequate
// for an ambient dashboard and fully deterministic.
function rankBestThirds(standings: Standing[]): TeamRef[] {
  const thirds = standings.filter((s) => s.rank === 3);
  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
    return a.team.name.localeCompare(b.team.name);
  });
  return thirds.slice(0, NUMBER_OF_BEST_THIRDS).map((s) => s.team);
}

// --- source label parsing --------------------------------------------------

const WINNER_GROUP_RE = /^winner\s+group\s+([a-z])$/i;
const RUNNERUP_GROUP_RE = /^runner-?up\s+group\s+([a-z])$/i;
const BEST_THIRD_RE = /^best\s+3rd\s*#?\s*(\d+)$/i;
const THIRD_GROUP_RE = /^3rd\s+group\s+([a-z])$/i;
const NODE_REF_RE = /^(winner|loser)\s+(.+)$/i;

// Normalize a node id or label so "R32-1", "r32-1" and "qf-1" compare cleanly.
function normalizeRef(ref: string): string {
  return ref.toLowerCase().replace(/[\s.]+/g, '');
}

// Does a slot source ("Winner R32-1") reference this node (id "r32-1" / label)?
function sourceRefsNode(source: string, node: BracketNode): boolean {
  const m = source.match(NODE_REF_RE);
  if (!m) return false;
  const ref = normalizeRef(m[2]);
  return ref === normalizeRef(node.id) || ref === normalizeRef(node.label);
}

// --- match helpers ---------------------------------------------------------

function matchIsDecided(match: Match): boolean {
  if (match.status !== 'finished') return false;
  if (match.winnerTeamId) return true;
  return (
    match.homeScore != null && match.awayScore != null && match.homeScore !== match.awayScore
  );
}

function winnerOf(match: Match): TeamRef | undefined {
  if (!matchIsDecided(match)) return undefined;
  if (match.winnerTeamId) {
    return match.winnerTeamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
  }
  return (match.homeScore ?? 0) > (match.awayScore ?? 0) ? match.homeTeam : match.awayTeam;
}

function loserOf(match: Match): TeamRef | undefined {
  const winner = winnerOf(match);
  if (!winner) return undefined;
  return winner.id === match.homeTeam.id ? match.awayTeam : match.homeTeam;
}

// Find the match backing a node: by explicit matchId, else by stage + the two
// resolved team ids (either home/away order).
function findMatch(
  node: BracketNode,
  home: TeamRef | undefined,
  away: TeamRef | undefined,
  matches: Match[],
  byId: Map<string, Match>,
): Match | undefined {
  if (node.matchId) {
    const linked = byId.get(node.matchId);
    if (linked) return linked;
  }
  if (!home || !away) return undefined;
  return matches.find(
    (m) =>
      m.stage === node.stage &&
      ((m.homeTeam.id === home.id && m.awayTeam.id === away.id) ||
        (m.homeTeam.id === away.id && m.awayTeam.id === home.id)),
  );
}

// --- engine ----------------------------------------------------------------

export function resolveBracket(
  matches: Match[],
  standings: Standing[],
  nodes: BracketNode[],
): ResolvedBracketNode[] {
  const byId = new Map<string, Match>(matches.map((m) => [m.id, m]));
  const nodeById = new Map<string, BracketNode>(nodes.map((n) => [n.id, n]));
  const thirdsDecided = allGroupsDecided(matches);
  const bestThirds = thirdsDecided ? rankBestThirds(standings) : [];

  // Resolve a source label that points at the group stage (winner/runner-up/3rd).
  function resolveGroupSource(source: string): TeamRef | undefined {
    let m = source.match(WINNER_GROUP_RE);
    if (m) return groupIsDecided(m[1].toUpperCase(), matches)
      ? standingFor(m[1].toUpperCase(), 1, standings)
      : undefined;

    m = source.match(RUNNERUP_GROUP_RE);
    if (m) return groupIsDecided(m[1].toUpperCase(), matches)
      ? standingFor(m[1].toUpperCase(), 2, standings)
      : undefined;

    m = source.match(BEST_THIRD_RE);
    if (m) return bestThirds[Number(m[1]) - 1];

    m = source.match(THIRD_GROUP_RE);
    if (m && thirdsDecided) {
      const team = standingFor(m[1].toUpperCase(), 3, standings);
      // Only resolves if that group's third is among the 8 that advanced.
      return team && bestThirds.some((t) => t.id === team.id) ? team : undefined;
    }
    return undefined;
  }

  // Initialize resolved nodes, seeding the group-derived slots up front.
  const resolved: ResolvedBracketNode[] = nodes.map((node) => ({
    id: node.id,
    stage: node.stage,
    label: node.label,
    matchId: node.matchId,
    winnerFeedsTo: node.winnerFeedsTo,
    home: { source: node.homeSource, team: resolveGroupSource(node.homeSource), isWinner: false },
    away: { source: node.awaySource, team: resolveGroupSource(node.awaySource), isWinner: false },
    decided: false,
  }));
  const resolvedById = new Map<string, ResolvedBracketNode>(resolved.map((n) => [n.id, n]));

  // Fixed-point loop: attach matches, compute winners/losers, then propagate
  // them forward along winnerFeedsTo (winners) and "Loser <node>" pulls (losers,
  // for the third-place node) until nothing changes. The bracket is a DAG, so
  // this converges in at most one pass per round.
  let changed = true;
  let guard = 0;
  while (changed && guard < nodes.length + 2) {
    changed = false;
    guard += 1;

    for (const rnode of resolved) {
      const node = nodeById.get(rnode.id)!;
      const match = findMatch(node, rnode.home.team, rnode.away.team, matches, byId);

      if (match) {
        rnode.matchId = match.id;
        rnode.status = match.status;
        rnode.kickoffUtc = match.kickoffUtc;

        // The backing match is authoritative for the actual teams + scores.
        const winner = winnerOf(match);
        for (const [slot, slotTeam] of [
          [rnode.home, match.homeTeam] as const,
          [rnode.away, match.awayTeam] as const,
        ]) {
          if (!isPlaceholderTeam(slotTeam) && slot.team?.id !== slotTeam.id) {
            slot.team = slotTeam;
            changed = true;
          }
        }
        const homeScore = match.homeTeam.id === rnode.home.team?.id ? match.homeScore : match.awayScore;
        const awayScore = match.homeTeam.id === rnode.home.team?.id ? match.awayScore : match.homeScore;
        if (rnode.home.score !== homeScore) { rnode.home.score = homeScore ?? undefined; }
        if (rnode.away.score !== awayScore) { rnode.away.score = awayScore ?? undefined; }
        rnode.home.isWinner = winner != null && rnode.home.team?.id === winner.id;
        rnode.away.isWinner = winner != null && rnode.away.team?.id === winner.id;
        if (winner && rnode.winner?.id !== winner.id) {
          rnode.winner = winner;
          changed = true;
        }
      }

      // Pull losers for the third-place node ("Loser SF-1").
      for (const slot of [rnode.home, rnode.away]) {
        if (slot.team) continue;
        const upstream = upstreamNodeFor(slot.source, nodes);
        if (!upstream) continue;
        const upMatch = byId.get(resolvedById.get(upstream.id)?.matchId ?? '');
        if (slot.source.match(NODE_REF_RE)?.[1].toLowerCase() === 'loser' && upMatch) {
          const loser = loserOf(upMatch);
          if (loser) { slot.team = loser; changed = true; }
        }
      }

      const nowDecided = rnode.home.team != null && rnode.away.team != null;
      if (nowDecided !== rnode.decided) { rnode.decided = nowDecided; changed = true; }
    }

    // Forward propagation along winnerFeedsTo: a decided node fills the slot of
    // its target whose source references it.
    for (const rnode of resolved) {
      if (!rnode.winner || !rnode.winnerFeedsTo) continue;
      const target = resolvedById.get(rnode.winnerFeedsTo);
      const targetNode = target && nodeById.get(target.id);
      if (!target || !targetNode) continue;
      for (const slot of [target.home, target.away]) {
        if (!slot.team && sourceRefsNode(slot.source, nodeById.get(rnode.id)!)) {
          slot.team = rnode.winner;
          changed = true;
        }
      }
    }
  }

  return resolved;
}

// A match's team is a placeholder (not yet a real qualifier) when its name reads
// like a source label rather than a nation.
function isPlaceholderTeam(team: TeamRef): boolean {
  return /^(winner|runner-?up|loser|best|3rd|tbd|to be)/i.test(team.name.trim());
}

function upstreamNodeFor(source: string, nodes: BracketNode[]): BracketNode | undefined {
  if (!NODE_REF_RE.test(source)) return undefined;
  return nodes.find((n) => sourceRefsNode(source, n));
}
