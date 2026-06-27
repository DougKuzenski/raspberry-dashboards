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

export type DecidedBy = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';

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
  /** Goals scored by each side in the penalty shootout. Present iff decidedBy === 'PENALTY_SHOOTOUT'. */
  penaltyHome?: number;
  penaltyAway?: number;
  /** How the match was ultimately decided. Omitted for unfinished or group-stage draws. */
  decidedBy?: DecidedBy;
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

// ---- Resolved bracket (derived) -------------------------------------------
// `BracketNode` (above) is the static skeleton: which slot pulls from which
// group/prior match. `ResolvedBracketNode` is what the seeding engine produces
// for the UI once standings and knockout results are known — see
// `resolveBracket.ts`. The transition panel consumes this same shape.

export interface BracketSlot {
  /** The static source label this slot pulls from, e.g. "Winner Group A". */
  source: string;
  /** The real team once the source is resolved; undefined while undecided. */
  team?: TeamRef;
  /** This slot's goals in the node's match, when the match has a score. */
  score?: number;
  /** True when this slot's team won the node's match. */
  isWinner: boolean;
}

export interface ResolvedBracketNode {
  id: string;
  stage: Stage;
  label: string;
  /** The match backing this node, if one has been linked/found. */
  matchId?: string;
  winnerFeedsTo?: string;
  home: BracketSlot;
  away: BracketSlot;
  /** Status of the backing match, when known (live/finished/…). */
  status?: MatchStatus;
  /** Kickoff of the backing match (UTC ISO), when known. */
  kickoffUtc?: string;
  /** The team that won this node's match, once decided. */
  winner?: TeamRef;
  /** True when both slots have resolved to real teams. */
  decided: boolean;
  /** How the match was decided (propagated from the backing Match). */
  decidedBy?: DecidedBy;
  /** Penalty shootout goals for the home side (present iff decidedBy === 'PENALTY_SHOOTOUT'). */
  penaltyHome?: number;
  /** Penalty shootout goals for the away side (present iff decidedBy === 'PENALTY_SHOOTOUT'). */
  penaltyAway?: number;
}

export type TournamentPhase = 'group' | 'knockout';

// The context-panel phase is a finer-grained, UI-only derivation of the same
// tournament progress. It adds a 'transition' state for the window when group
// games are wrapping up but the knockout bracket is already forming, so the panel
// can show group standings AND the forming bracket together. Derived purely from
// the matches by `deriveContextPhase` — never set by the server, never clock-based.
export type ContextPhase = 'group' | 'transition' | 'knockout';

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
  /** Every game from the start of today through the end of tomorrow (target zone). */
  todayTomorrowMatches: Match[];
  recentResults: Match[];
  nextMatch?: Match;
  featuredGroup?: string;
  featuredStandings: Standing[];
  showBracket: boolean;
  /**
   * Three-state context-panel phase (group / transition / knockout). The panel
   * shows standings only in 'group', both standings and the forming bracket in
   * 'transition', and the bracket only in 'knockout'. (`showBracket` stays as the
   * boolean for the 'knockout' case.)
   */
  contextPhase: ContextPhase;
  /** The knockout bracket with sources resolved to real teams + scores. */
  bracket: ResolvedBracketNode[];
}
