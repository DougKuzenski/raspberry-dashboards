import type { Match, MatchStatus, Stage, TeamRef } from '../../shared/types.js';

// Shape that external providers tend to deliver — deliberately different from our
// internal Match so the normalization step is real. The stub providers read
// sample JSON in this shape; a live adapter would map an API response to it.
export interface RemoteTeam {
  code: string;
  name: string;
  short?: string;
  flag?: string;
}

export interface RemoteMatch {
  id: string;
  stage: string;
  group?: string;
  home: RemoteTeam;
  away: RemoteTeam;
  kickoff: string;
  venue?: string;
  city?: string;
  state: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  minute?: number | null;
}

const STATE_TO_STATUS: Record<string, MatchStatus> = {
  scheduled: 'scheduled',
  upcoming: 'scheduled',
  pre: 'pre_match',
  pre_match: 'pre_match',
  live: 'live',
  in_play: 'live',
  ht: 'halftime',
  halftime: 'halftime',
  finished: 'finished',
  ft: 'finished',
  postponed: 'postponed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

const VALID_STAGES = new Set<Stage>([
  'group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final',
]);

function toTeam(t: RemoteTeam): TeamRef {
  return { id: t.code, name: t.name, shortName: t.short ?? t.code, flagEmoji: t.flag };
}

function toStatus(state: string): MatchStatus {
  return STATE_TO_STATUS[state.toLowerCase()] ?? 'scheduled';
}

function toStage(stage: string): Stage {
  const s = stage as Stage;
  return VALID_STAGES.has(s) ? s : 'group';
}

export function normalizeMatch(remote: RemoteMatch): Match {
  const status = toStatus(remote.state);
  const homeScore = remote.homeGoals ?? undefined;
  const awayScore = remote.awayGoals ?? undefined;

  let winnerTeamId: string | undefined;
  if (status === 'finished' && homeScore != null && awayScore != null && homeScore !== awayScore) {
    winnerTeamId = homeScore > awayScore ? remote.home.code : remote.away.code;
  }

  return {
    id: remote.id,
    stage: toStage(remote.stage),
    group: remote.group,
    homeTeam: toTeam(remote.home),
    awayTeam: toTeam(remote.away),
    kickoffUtc: remote.kickoff,
    venue: remote.venue,
    city: remote.city,
    status,
    minute: remote.minute ?? undefined,
    homeScore,
    awayScore,
    winnerTeamId,
  };
}
