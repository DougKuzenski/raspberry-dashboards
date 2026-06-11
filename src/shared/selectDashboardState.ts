// Pure transform from raw DashboardData -> DashboardView (what the UI renders).
// Lives in shared because the client recomputes it every render against the live
// clock, so the hero card and "today" buckets stay correct between data fetches.
import type { DashboardData, DashboardView, Match, TournamentPhase } from './types.js';
import { DEFAULT_TIMEZONE, RECENT_RESULT_WINDOW_HOURS } from './constants.js';
import { isSameLocalDay } from './time.js';

// The tournament is in its group phase while any group match has yet to finish;
// once every group game is done (or the dataset has no group games left), we're
// into the knockout phase. Works whether the data is just the group stage or the
// full 104-match schedule (which always contains knockout fixtures).
export function deriveTournamentPhase(matches: Match[]): TournamentPhase {
  const groupRemaining = matches.some(
    (m) => m.stage === 'group' && m.status !== 'finished' && m.status !== 'cancelled',
  );
  return groupRemaining ? 'group' : 'knockout';
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

  // Context panel: group standings during group stage, bracket during knockout.
  const showBracket = data.tournamentPhase === 'knockout';

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
  };
}
