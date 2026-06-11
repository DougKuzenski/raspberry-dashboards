import type { Match, MatchStatus, Stage, TeamRef } from '../../shared/types.js';
import { resolveTeam } from '../providers/teams.js';

// Adapter for the OpenFootball worldcup.json shape:
//   { name, matches: [{ round, date:"2026-06-11", time:"13:00 UTC-6",
//                       team1, team2, group:"Group A", ground, score? }] }
// OpenFootball has no status field and (pre-tournament) no scores, so status is
// inferred from kickoff vs now. Once OpenFootball publishes a `score`, we mark
// the match finished. Manual overrides can correct anything on top of this.

export interface OpenFootballMatch {
  round?: string;
  date?: string;
  time?: string;
  team1?: string;
  team2?: string;
  group?: string;
  ground?: string;
  // OpenFootball score shapes seen across tournaments; all optional.
  score?: { ft?: [number, number]; ht?: [number, number] };
  score1?: number;
  score2?: number;
}

export interface OpenFootballFile {
  name?: string;
  matches?: OpenFootballMatch[];
}

// Treat a match as possibly in-progress for this long after kickoff when we have
// no score and no status from the source.
const LIVE_WINDOW_MS = 135 * 60 * 1000; // 2h15m

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// "13:00 UTC-6" + "2026-06-11" -> "2026-06-11T19:00:00.000Z"
export function parseKickoffUtc(date: string, time: string | undefined): string {
  if (!time) return new Date(`${date}T00:00:00Z`).toISOString();
  const [clock, zone] = time.trim().split(/\s+/);
  const offset = zone?.match(/UTC([+-])(\d{1,2})(?::?(\d{2}))?/);
  const offsetStr = offset
    ? `${offset[1]}${pad2(Number(offset[2]))}:${pad2(Number(offset[3] ?? 0))}`
    : 'Z'; // no zone given -> treat clock as UTC
  const hhmm = clock.includes(':') ? clock : `${clock}:00`;
  const parsed = new Date(`${date}T${hhmm}:00${offsetStr}`);
  if (Number.isNaN(parsed.getTime())) return new Date(`${date}T00:00:00Z`).toISOString();
  return parsed.toISOString();
}

function stageFromRound(round: string | undefined, hasGroup: boolean): Stage {
  if (hasGroup) return 'group';
  const r = (round ?? '').toLowerCase();
  if (r.includes('round of 32')) return 'round_of_32';
  if (r.includes('round of 16')) return 'round_of_16';
  if (r.includes('quarter')) return 'quarterfinal';
  if (r.includes('semi')) return 'semifinal';
  if (r.includes('third')) return 'third_place';
  if (r.includes('final')) return 'final';
  return 'group';
}

function groupLetter(group: string | undefined): string | undefined {
  if (!group) return undefined;
  const m = group.match(/group\s+([a-l])/i);
  return m ? m[1].toUpperCase() : group;
}

// Knockout slots arrive as codes ("1A", "2B", "W74", "L101"). Turn recognizable
// codes into human placeholder labels; otherwise resolve as a real nation.
function resolveSlot(name: string | undefined): TeamRef {
  const raw = (name ?? 'TBD').trim();
  const pos = raw.match(/^([123])([A-L])$/i);
  if (pos) {
    const rank = pos[1] === '1' ? 'Winner' : pos[1] === '2' ? 'Runner-up' : '3rd';
    return { id: raw.toUpperCase(), name: `${rank} Group ${pos[2].toUpperCase()}`, shortName: raw.toUpperCase() };
  }
  const win = raw.match(/^([WL])(\d+)$/i);
  if (win) {
    const verb = win[1].toUpperCase() === 'W' ? 'Winner' : 'Loser';
    return { id: raw.toUpperCase(), name: `${verb} Match ${win[2]}`, shortName: raw.toUpperCase() };
  }
  return resolveTeam(raw);
}

function readScore(m: OpenFootballMatch): [number, number] | undefined {
  if (m.score?.ft && m.score.ft.length === 2) return m.score.ft;
  if (typeof m.score1 === 'number' && typeof m.score2 === 'number') return [m.score1, m.score2];
  return undefined;
}

function inferStatus(kickoffUtc: string, hasScore: boolean, now: Date): MatchStatus {
  if (hasScore) return 'finished';
  const start = new Date(kickoffUtc).getTime();
  const nowMs = now.getTime();
  if (nowMs < start) return 'scheduled';
  if (nowMs <= start + LIVE_WINDOW_MS) return 'live';
  return 'finished';
}

export function parseOpenFootball(file: OpenFootballFile, now: Date = new Date()): Match[] {
  const matches = file.matches ?? [];
  return matches.map((m, i) => {
    const date = m.date ?? '1970-01-01';
    const kickoffUtc = parseKickoffUtc(date, m.time);
    const hasGroup = Boolean(m.group);
    const stage = stageFromRound(m.round, hasGroup);
    const homeTeam = resolveSlot(m.team1);
    const awayTeam = resolveSlot(m.team2);
    const score = readScore(m);
    const status = inferStatus(kickoffUtc, Boolean(score), now);

    let winnerTeamId: string | undefined;
    if (score && status === 'finished' && score[0] !== score[1]) {
      winnerTeamId = score[0] > score[1] ? homeTeam.id : awayTeam.id;
    }

    return {
      id: `of-${date}-${homeTeam.id}-${awayTeam.id}-${i}`,
      stage,
      group: groupLetter(m.group),
      homeTeam,
      awayTeam,
      kickoffUtc,
      venue: m.ground,
      city: m.ground,
      status,
      homeScore: score?.[0],
      awayScore: score?.[1],
      winnerTeamId,
    };
  });
}
