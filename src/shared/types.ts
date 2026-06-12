// Shared data model for the World Cup dashboard. Imported by both the Express
// server and the React client, so keep this dependency-free.

export type MatchStatus =
  | 'scheduled'
  | 'pre_match'
  | 'live'
  | 'halftime'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export type Stage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'final';

export interface TeamRef {
  id: string;
  name: string;
  shortName?: string;
  countryCode?: string;
  flagEmoji?: string;
}

export interface Match {
  id: string;
  stage: Stage;
  group?: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  kickoffUtc: string;
  venue?: string;
  city?: string;
  status: MatchStatus;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  winnerTeamId?: string;
  tv?: string;
  stream?: string;
  notes?: string;
}

export interface Standing {
  group: string;
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  rank: number;
}

export interface BracketNode {
  id: string;
  stage: Stage;
  matchId?: string;
  label: string;
  homeSource: string;
  awaySource: string;
  winnerFeedsTo?: string;
}

export type TournamentPhase = 'group' | 'knockout';

export interface DashboardData {
  generatedAtUtc: string;
  tournamentPhase: TournamentPhase;
  matches: Match[];
  standings: Standing[];
  bracket: BracketNode[];
  manualMessage?: string;
  /**
   * IANA timezone all kickoff times are rendered in (e.g. "America/Los_Angeles").
   * Resolved server-side from the TIMEZONE env var or config.json; the client
   * falls back to DEFAULT_TIMEZONE when this is absent.
   */
  timezone?: string;
  /** Name of the provider that produced this payload (e.g. "manual"). */
  source?: string;
  /** True when the server is serving cached/last-good data after a failure. */
  stale?: boolean;
}

// Derived view computed by selectDashboardState — what the UI actually renders.
export interface DashboardView {
  data: DashboardData;
  liveMatches: Match[];
  todayMatches: Match[];
  upcomingMatches: Match[];
  recentResults: Match[];
  nextMatch?: Match;
  heroMatch?: Match;
  featuredGroup?: string;
  featuredStandings: Standing[];
  showBracket: boolean;
}
