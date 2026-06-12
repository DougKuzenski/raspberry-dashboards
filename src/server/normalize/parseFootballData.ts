import type { Match, MatchStatus, Stage, TeamRef } from '../../shared/types.js';
import { resolveTeam } from '../providers/teams.js';

// Adapter for the football-data.org v4 match shape
// (GET /v4/competitions/WC/matches). This source has real status + live scores,
// so unlike OpenFootball we trust its status field directly rather than inferring.

interface FDTeam {
  id?: number | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

interface FDScore {
  winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  fullTime?: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}

export interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  stage?: string;
  group?: string | null;
  minute?: number | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score?: FDScore;
}

export interface FootballDataResponse {
  matches?: FDMatch[];
}

const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  IN_PLAY: 'live',
  PAUSED: 'halftime',
  SUSPENDED: 'live',
  FINISHED: 'finished',
  AWARDED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
};

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: 'group',
  LAST_32: 'round_of_32',
  LAST_16: 'round_of_16',
  QUARTER_FINALS: 'quarterfinal',
  SEMI_FINALS: 'semifinal',
  THIRD_PLACE: 'third_place',
  '3RD_PLACE': 'third_place',
  FINAL: 'final',
};

function mapStatus(s: string): MatchStatus {
  return STATUS_MAP[s] ?? 'scheduled';
}

function mapStage(s: string | undefined): Stage {
  if (!s) return 'group';
  return STAGE_MAP[s] ?? 'group';
}

function groupLetter(group: string | null | undefined): string | undefined {
  if (!group) return undefined;
  const m = group.match(/group[_\s]?([a-l])/i);
  return m ? m[1].toUpperCase() : undefined;
}

// football-data gives name + tla (3-letter code). Use tla as the id/short code,
// and borrow a flag emoji from our nation lookup by name. Knockout slots before
// teams are known come through with null names -> "TBD".
function toTeam(t: FDTeam): TeamRef {
  const name = t.name ?? 'TBD';
  const resolved = resolveTeam(name);
  const code = t.tla ?? resolved.id;
  return { id: code, name, shortName: t.tla ?? resolved.shortName, flagEmoji: resolved.flagEmoji };
}

export function parseFootballData(data: FootballDataResponse): Match[] {
  const matches = data.matches ?? [];
  return matches.map((m): Match => {
    const status = mapStatus(m.status);
    const home = toTeam(m.homeTeam);
    const away = toTeam(m.awayTeam);
    const ft = m.score?.fullTime;
    const homeScore = ft?.home ?? undefined;
    const awayScore = ft?.away ?? undefined;

    let winnerTeamId: string | undefined;
    if (m.score?.winner === 'HOME_TEAM') winnerTeamId = home.id;
    else if (m.score?.winner === 'AWAY_TEAM') winnerTeamId = away.id;

    return {
      id: `fd-${m.id}`,
      stage: mapStage(m.stage),
      group: groupLetter(m.group),
      homeTeam: home,
      awayTeam: away,
      kickoffUtc: m.utcDate,
      status,
      minute: status === 'live' ? m.minute ?? undefined : undefined,
      homeScore,
      awayScore,
      winnerTeamId,
    };
  });
}
