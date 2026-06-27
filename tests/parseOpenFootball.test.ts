import { describe, it, expect } from 'vitest';
import {
  parseOpenFootball,
  parseKickoffUtc,
  type OpenFootballFile,
} from '../src/server/normalize/parseOpenFootball.js';

describe('parseKickoffUtc', () => {
  it('converts local time with a UTC offset to a UTC ISO string', () => {
    expect(parseKickoffUtc('2026-06-11', '13:00 UTC-6')).toBe('2026-06-11T19:00:00.000Z');
    expect(parseKickoffUtc('2026-06-18', '12:00 UTC-4')).toBe('2026-06-18T16:00:00.000Z');
  });

  it('treats a missing zone as UTC', () => {
    expect(parseKickoffUtc('2026-06-11', '20:00')).toBe('2026-06-11T20:00:00.000Z');
  });
});

describe('parseOpenFootball', () => {
  const now = new Date('2026-06-11T17:00:00Z'); // before the 19:00Z kickoff

  const file: OpenFootballFile = {
    name: 'World Cup 2026',
    matches: [
      {
        round: 'Matchday 1',
        date: '2026-06-11',
        time: '13:00 UTC-6',
        team1: 'Mexico',
        team2: 'South Africa',
        group: 'Group A',
        ground: 'Mexico City',
      },
      {
        round: 'Round of 32',
        date: '2026-06-29',
        time: '15:00 UTC-5',
        team1: '1A',
        team2: '2B',
        ground: 'Los Angeles',
      },
    ],
  };

  it('maps a group fixture with resolved team codes and inferred status', () => {
    const [m] = parseOpenFootball(file, now);
    expect(m.stage).toBe('group');
    expect(m.group).toBe('A');
    expect(m.homeTeam.id).toBe('MEX');
    expect(m.homeTeam.flagEmoji).toBe('🇲🇽');
    expect(m.kickoffUtc).toBe('2026-06-11T19:00:00.000Z');
    expect(m.status).toBe('scheduled'); // now < kickoff
  });

  it('maps a knockout fixture with placeholder slot labels', () => {
    const [, ko] = parseOpenFootball(file, now);
    expect(ko.stage).toBe('round_of_32');
    expect(ko.group).toBeUndefined();
    expect(ko.homeTeam.name).toBe('Winner Group A');
    expect(ko.awayTeam.name).toBe('Runner-up Group B');
  });

  it('infers live during the post-kickoff window when no score is present', () => {
    const during = new Date('2026-06-11T19:30:00Z');
    const [m] = parseOpenFootball(file, during);
    expect(m.status).toBe('live');
  });

  it('marks finished and resolves a winner when a score is present', () => {
    const scored: OpenFootballFile = {
      matches: [{ ...file.matches![0], score: { ft: [2, 1] } }],
    };
    const [m] = parseOpenFootball(scored, now);
    expect(m.status).toBe('finished');
    expect(m.homeScore).toBe(2);
    expect(m.winnerTeamId).toBe('MEX');
    expect(m.decidedBy).toBe('REGULAR');
  });
});

// 2022 World Cup real penalty shootout fixtures used as ground truth.
// team1 = home slot, team2 = away slot in the openfootball format.
describe('parseOpenFootball — penalty shootout (2022 real fixtures)', () => {
  const PAST = new Date('2022-12-10T00:00:00Z');

  function koMatch(
    team1: string,
    team2: string,
    score: { ft: [number, number]; et?: [number, number]; p?: [number, number] },
  ): OpenFootballFile {
    return {
      matches: [{
        round: 'Round of 16',
        date: '2022-12-05',
        time: '14:00 UTC',
        team1,
        team2,
        score,
      }],
    };
  }

  it('Japan-Croatia ft 1-1 p 1-3: Croatia wins, displayed score stays 1-1', () => {
    const [m] = parseOpenFootball(koMatch('Japan', 'Croatia', { ft: [1, 1], p: [1, 3] }), PAST);
    expect(m.winnerTeamId).toBe('CRO');
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(1);
    expect(m.penaltyAway).toBe(3);
  });

  it('Morocco-Spain ft 0-0 p 3-0: Morocco wins, displayed score stays 0-0', () => {
    const [m] = parseOpenFootball(koMatch('Morocco', 'Spain', { ft: [0, 0], p: [3, 0] }), PAST);
    expect(m.winnerTeamId).toBe('MAR');
    expect(m.homeScore).toBe(0);
    expect(m.awayScore).toBe(0);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(3);
    expect(m.penaltyAway).toBe(0);
  });

  it('Croatia-Brazil ft 0-0 et 1-1 p 4-2: Croatia wins, displayed score is et 1-1', () => {
    const [m] = parseOpenFootball(koMatch('Croatia', 'Brazil', { ft: [0, 0], et: [1, 1], p: [4, 2] }), PAST);
    expect(m.winnerTeamId).toBe('CRO');
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(4);
    expect(m.penaltyAway).toBe(2);
  });

  it('Netherlands-Argentina ft 2-2 p 3-4: Argentina wins, displayed score stays 2-2', () => {
    const [m] = parseOpenFootball(koMatch('Netherlands', 'Argentina', { ft: [2, 2], p: [3, 4] }), PAST);
    expect(m.winnerTeamId).toBe('ARG');
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(2);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(3);
    expect(m.penaltyAway).toBe(4);
  });

  it('Argentina-France (Final) ft 2-2 et 3-3 p 4-2: Argentina wins, displayed score is et 3-3', () => {
    const [m] = parseOpenFootball(koMatch('Argentina', 'France', { ft: [2, 2], et: [3, 3], p: [4, 2] }), PAST);
    expect(m.winnerTeamId).toBe('ARG');
    expect(m.homeScore).toBe(3);
    expect(m.awayScore).toBe(3);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(4);
    expect(m.penaltyAway).toBe(2);
  });

  it('extra time with no penalties: winner from et, displayed score is et', () => {
    // Hypothetical: ft 0-0, et 1-0 (home wins in extra time).
    const [m] = parseOpenFootball(koMatch('Germany', 'France', { ft: [0, 0], et: [1, 0] }), PAST);
    expect(m.winnerTeamId).toBe('GER');
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(0);
    expect(m.decidedBy).toBe('EXTRA_TIME');
    expect(m.penaltyHome).toBeUndefined();
    expect(m.penaltyAway).toBeUndefined();
  });
});
