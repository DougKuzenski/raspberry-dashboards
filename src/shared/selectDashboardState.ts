// Pure transform from raw DashboardData -> DashboardView (what the UI renders).
// Lives in shared because the client recomputes it every render against the live
// clock, so the hero card and "today" buckets stay correct between data fetches.
import type {
  ContextPhase,
  DashboardData,
  DashboardView,
  Match,
  TournamentPhase,
} from './types.js';
import { DEFAULT_TIMEZONE, RECENT_RESULT_WINDOW_HOURS } from './constants.js';
import { isSameLocalDay } from './time.js';
import { resolveBracket, matchIsDecided } from './resolveBracket.js';

// A group match still left to play (cancelled games don't block, matching the
// server-side phase rule).
function groupMatchesRemaining(matches: Match[]): boolean {
  return matches.some(
    (m) => m.stage === 'group' && m.status !== 'finished' && m.status !== 'cancelled',
  );
}

// True once at least one group is mathematically decided — every one of that
// group's group matches is finished (mirrors `groupIsDecided` in resolveBracket,
// so a placeholder slot and the transition trigger agree on "group settled").
function anyGroupDecided(matches: Match[]): boolean {
  const groups = new Set(
    matches.filter((m) => m.stage === 'group' && m.group).map((m) => m.group as string),
  );
  for (const group of groups) {
    const groupMatches = matches.filter((m) => m.stage === 'group' && m.group === group);
    if (groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished')) {
      return true;
    }
  }
  return false;
}

// The tournament is in its group phase while any group match has yet to finish;
// once every group game is done (or the dataset has no group games left), we're
// into the knockout phase. Works whether the data is just the group stage or the
// full 104-match schedule (which always contains knockout fixtures).
export function deriveTournamentPhase(matches: Match[]): TournamentPhase {
  return groupMatchesRemaining(matches) ? 'group' : 'knockout';
}

// True once a knockout match has produced a result (the first R32 game, in
// practice — R32 is the first knockout round). This is the boundary where group
// rankings disappear and the windowed knockout view takes over.
function anyKnockoutResult(matches: Match[]): boolean {
  return matches.some((m) => m.stage !== 'group' && matchIsDecided(m));
}

// The windowed knockout view is active once the group stage is officially complete
// AND the first knockout result has landed (spec §6 boundary). Before that we are
// still showing group rankings (in 'group' or 'transition'). Single source of truth
// shared by deriveContextPhase and shouldShowGroupRankings so they cannot drift.
function knockoutWindowingActive(matches: Match[]): boolean {
  return !groupMatchesRemaining(matches) && anyKnockoutResult(matches);
}

// Three-state context-panel phase (spec §6: group → transition → knockout):
//   - 'knockout'   once the group stage is complete AND the first knockout result
//                  has landed — rankings drop, the windowed current+next rounds show,
//   - 'transition' while the bracket is forming but no knockout result yet: a
//     knockout match is already scheduled (any non-group match exists) OR at least
//     one group is mathematically decided — shown as rankings + the R32 pairings box,
//   - 'group'      before any of that.
// Pure and clock-independent, like the rest of the selector. Note the boundary into
// 'knockout' is the first R32 RESULT, not merely the group stage finishing — until a
// knockout game is decided we stay in 'transition' (rankings + R32 box).
export function deriveContextPhase(matches: Match[]): ContextPhase {
  if (knockoutWindowingActive(matches)) return 'knockout';
  const knockoutScheduled = matches.some((m) => m.stage !== 'group');
  if (knockoutScheduled || anyGroupDecided(matches)) return 'transition';
  return 'group';
}

// Group rankings visibility (spec §6): show them through the group stage AND the
// transition, hiding only once the group stage is complete AND >= 1 knockout result
// has landed — i.e. exactly when the windowed knockout view begins. Exposed as its
// own pure predicate for clarity and direct unit testing.
export function shouldShowGroupRankings(matches: Match[]): boolean {
  return !knockoutWindowingActive(matches);
}

const LIVE_STATUSES = new Set<Match['status']>(['live', 'halftime', 'pre_match']);

function kickoff(m: Match): number {
  return new Date(m.kickoffUtc).getTime();
}

// Live matches first, then most "important" by earliest kickoff. Favorite-team
// weighting is applied in the UI accent, not here, to keep ordering predictable.
function byKickoffAsc(a: Match, b: Match): number {
  return kickoff(a) - kickoff(b);
}

export function selectDashboardState(
  data: DashboardData,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): DashboardView {
  const nowMs = now.getTime();
  const matches = [...data.matches].sort(byKickoffAsc);

  const liveMatches = matches.filter((m) => LIVE_STATUSES.has(m.status));

  const todayMatches = matches.filter((m) => isSameLocalDay(new Date(m.kickoffUtc), now, timeZone));

  const upcomingMatches = matches.filter(
    (m) => (m.status === 'scheduled' || m.status === 'pre_match') && kickoff(m) >= nowMs,
  );

  const nextMatch = upcomingMatches[0];

  const recentWindowMs = RECENT_RESULT_WINDOW_HOURS * 60 * 60 * 1000;
  const recentResults = matches
    .filter((m) => m.status === 'finished' && nowMs - kickoff(m) <= recentWindowMs)
    .sort((a, b) => kickoff(b) - kickoff(a));

  // Hero: the most important live match, otherwise the next upcoming match.
  const heroMatch = liveMatches[0] ?? nextMatch;

  // Context panel: group standings during the group stage, both standings and the
  // forming bracket during the transition, the bracket alone during knockout.
  // Derived from the matches (not the server-set phase) so the transition window
  // is detected the moment the bracket starts to form.
  const contextPhase = deriveContextPhase(data.matches);
  const showBracket = contextPhase === 'knockout';

  // Resolve the static bracket skeleton against live standings + results. Pure
  // (clock-independent), so it's safe to recompute here every render.
  const bracket = resolveBracket(data.matches, data.standings, data.bracket);

  const featuredGroup =
    !showBracket && heroMatch?.stage === 'group' ? heroMatch.group : undefined;

  const featuredStandings = featuredGroup
    ? data.standings.filter((s) => s.group === featuredGroup).sort((a, b) => a.rank - b.rank)
    : data.standings.slice().sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);

  return {
    data,
    liveMatches,
    todayMatches,
    upcomingMatches,
    recentResults,
    nextMatch,
    heroMatch,
    featuredGroup,
    featuredStandings,
    showBracket,
    contextPhase,
    bracket,
  };
}
