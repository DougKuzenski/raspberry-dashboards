import type { DecidedBy, Match, MatchStatus, Stage, TeamRef } from '../../shared/types.js';
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
  duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | null;
  fullTime?: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
  regularTime?: { home: number | null; away: number | null };
  extraTime?: { home: number | null; away: number | null };
  penalties?: { home: number | null; away: number | null };
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
    const duration = m.score?.duration;

    // When duration is non-REGULAR, use regularTime as the 90-min displayed score
    // (fullTime may be the aggregate including ET/pens goals per the API docs).
    // Guard: if regularTime is absent, fall back to fullTime to avoid a regression.
    const scoreObj =
      duration && duration !== 'REGULAR' && m.score?.regularTime != null
        ? m.score.regularTime
        : m.score?.fullTime;

    const homeScore = scoreObj?.home ?? undefined;
    const awayScore = scoreObj?.away ?? undefined;

    let winnerTeamId: string | undefined;
    if (m.score?.winner === 'HOME_TEAM') winnerTeamId = home.id;
    else if (m.score?.winner === 'AWAY_TEAM') winnerTeamId = away.id;

    let decidedBy: DecidedBy | undefined;
    let penaltyHome: number | undefined;
    let penaltyAway: number | undefined;
    if (duration === 'PENALTY_SHOOTOUT') {
      decidedBy = 'PENALTY_SHOOTOUT';

      // football-data's `score.penalties` is the well-formed shootout tally for
      // most sources, BUT the WC2026 live feed leaves it equal & incomplete
      // (it omits sudden-death kicks, e.g. 4-4 for GER-PAR, 3-3 for NED-MAR) and
      // instead carries the decisive aggregate in `score.fullTime` (4-5, 3-4).
      // Verified live (matches 537415, 537418): the side with the higher
      // fullTime is the team that advanced. So pick whichever pair is DECISIVE
      // (unequal) as the displayed shootout score: a complete `penalties` when
      // present, else `fullTime`, which carries the real tally in the live shape.
      const pen = m.score?.penalties;
      const full = m.score?.fullTime;
      const penDecisive = pen?.home != null && pen?.away != null && pen.home !== pen.away;
      const fullDecisive =
        full?.home != null && full?.away != null && full.home !== full.away;

      if (penDecisive) {
        penaltyHome = pen!.home!;
        penaltyAway = pen!.away!;
      } else if (fullDecisive) {
        penaltyHome = full!.home!;
        penaltyAway = full!.away!;
      } else {
        // Neither pair is decisive (genuinely incomplete data): show penalties
        // as-is for transparency, but leave the winner underived below.
        penaltyHome = pen?.home ?? undefined;
        penaltyAway = pen?.away ?? undefined;
      }

      // Derive the winner when the source didn't already give an explicit
      // HOME/AWAY winner (for shootouts it reports null or DRAW). Precedence:
      // the verified fullTime-based rule first (authoritative final aggregate),
      // else unequal penalties.
      if (!winnerTeamId) {
        if (fullDecisive) {
          winnerTeamId = full!.home! > full!.away! ? home.id : away.id;
        } else if (penDecisive) {
          winnerTeamId = pen!.home! > pen!.away! ? home.id : away.id;
        }
      }
    } else if (duration === 'EXTRA_TIME') {
      decidedBy = 'EXTRA_TIME';
    } else if (duration === 'REGULAR') {
      decidedBy = 'REGULAR';
    }

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
      penaltyHome,
      penaltyAway,
      decidedBy,
    };
  });
}
