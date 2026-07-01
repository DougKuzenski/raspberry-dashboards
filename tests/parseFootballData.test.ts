import { describe, it, expect } from 'vitest';
import { parseFootballData, type FootballDataResponse } from '../src/server/normalize/parseFootballData.js';

const sample: FootballDataResponse = {
  matches: [
    {
      id: 1,
      utcDate: '2026-06-11T19:00:00Z',
      status: 'IN_PLAY',
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      minute: 63,
      homeTeam: { id: 10, name: 'Mexico', tla: 'MEX' },
      awayTeam: { id: 11, name: 'South Africa', tla: 'RSA' },
      score: { winner: null, fullTime: { home: 1, away: 0 }, halfTime: { home: 0, away: 0 } },
    },
    {
      id: 2,
      utcDate: '2026-06-12T16:00:00Z',
      status: 'FINISHED',
      stage: 'GROUP_STAGE',
      group: 'GROUP_B',
      homeTeam: { id: 12, name: 'Canada', tla: 'CAN' },
      awayTeam: { id: 13, name: 'Croatia', tla: 'CRO' },
      score: { winner: 'HOME_TEAM', fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } },
    },
    {
      id: 3,
      utcDate: '2026-06-29T19:00:00Z',
      status: 'TIMED',
      stage: 'LAST_16',
      group: null,
      homeTeam: { id: null, name: null, tla: null },
      awayTeam: { id: null, name: null, tla: null },
      score: { winner: null, fullTime: { home: null, away: null } },
    },
  ],
};

describe('parseFootballData', () => {
  it('maps a live group match with minute and current score', () => {
    const [m] = parseFootballData(sample);
    expect(m.status).toBe('live');
    expect(m.minute).toBe(63);
    expect(m.group).toBe('A');
    expect(m.homeTeam.id).toBe('MEX');
    expect(m.homeTeam.flagEmoji).toBe('🇲🇽'); // flag borrowed from nation lookup
    expect(m.homeScore).toBe(1);
  });

  it('maps a finished match and resolves the winner from score.winner', () => {
    const [, m] = parseFootballData(sample);
    expect(m.status).toBe('finished');
    expect(m.winnerTeamId).toBe('CAN');
    expect(m.homeScore).toBe(2);
  });

  it('maps a knockout match with no teams yet to a TBD placeholder', () => {
    const [, , m] = parseFootballData(sample);
    expect(m.stage).toBe('round_of_16');
    expect(m.group).toBeUndefined();
    expect(m.homeTeam.name).toBe('TBD');
    expect(m.homeScore).toBeUndefined();
  });
});

describe('parseFootballData — extra-time and penalty-shootout handling', () => {
  it('PENALTY_SHOOTOUT: displayed score uses regularTime not aggregate fullTime', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 42,
        utcDate: '2022-12-05T14:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_16',
        group: null,
        homeTeam: { id: 10, name: 'Japan', tla: 'JPN' },
        awayTeam: { id: 11, name: 'Croatia', tla: 'CRO' },
        score: {
          winner: 'AWAY_TEAM',
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 1, away: 1 },
          fullTime: { home: 1, away: 1 },
          extraTime: { home: 1, away: 1 },
          penalties: { home: 1, away: 3 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.winnerTeamId).toBe('CRO');
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.penaltyHome).toBe(1);
    expect(m.penaltyAway).toBe(3);
  });

  it('PENALTY_SHOOTOUT: falls back to fullTime when regularTime is absent', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 43,
        utcDate: '2022-12-05T18:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_16',
        group: null,
        homeTeam: { id: 12, name: 'Morocco', tla: 'MAR' },
        awayTeam: { id: 13, name: 'Spain', tla: 'ESP' },
        score: {
          winner: 'HOME_TEAM',
          duration: 'PENALTY_SHOOTOUT',
          fullTime: { home: 0, away: 0 },
          penalties: { home: 3, away: 0 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.homeScore).toBe(0);
    expect(m.awayScore).toBe(0);
    expect(m.winnerTeamId).toBe('MAR');
    expect(m.penaltyHome).toBe(3);
    expect(m.penaltyAway).toBe(0);
  });

  it('EXTRA_TIME: displayed score uses regularTime, decidedBy is EXTRA_TIME, no penalty fields', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 44,
        utcDate: '2022-12-06T14:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_16',
        group: null,
        homeTeam: { id: 14, name: 'France', tla: 'FRA' },
        awayTeam: { id: 15, name: 'Poland', tla: 'POL' },
        score: {
          winner: 'HOME_TEAM',
          duration: 'EXTRA_TIME',
          regularTime: { home: 1, away: 1 },
          fullTime: { home: 3, away: 1 },
          extraTime: { home: 3, away: 1 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    expect(m.winnerTeamId).toBe('FRA');
    expect(m.decidedBy).toBe('EXTRA_TIME');
    expect(m.penaltyHome).toBeUndefined();
    expect(m.penaltyAway).toBeUndefined();
  });

  it('REGULAR: existing behavior unchanged', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 45,
        utcDate: '2022-12-06T18:00:00Z',
        status: 'FINISHED',
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        homeTeam: { id: 16, name: 'Canada', tla: 'CAN' },
        awayTeam: { id: 17, name: 'Belgium', tla: 'BEL' },
        score: {
          winner: 'AWAY_TEAM',
          duration: 'REGULAR',
          fullTime: { home: 0, away: 1 },
          halfTime: { home: 0, away: 0 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.homeScore).toBe(0);
    expect(m.awayScore).toBe(1);
    expect(m.winnerTeamId).toBe('BEL');
    expect(m.decidedBy).toBe('REGULAR');
    expect(m.penaltyHome).toBeUndefined();
  });

  it('derives winnerTeamId from penalties when score.winner is DRAW in a PENALTY_SHOOTOUT match', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 46,
        utcDate: '2026-06-29T18:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_32',
        group: null,
        homeTeam: { id: 10, name: 'Germany', tla: 'GER' },
        awayTeam: { id: 11, name: 'Paraguay', tla: 'PAR' },
        score: {
          winner: 'DRAW',
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 1, away: 1 },
          fullTime: { home: 1, away: 1 },
          penalties: { home: 4, away: 5 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.winnerTeamId).toBe('PAR');
    expect(m.penaltyHome).toBe(4);
    expect(m.penaltyAway).toBe(5);
  });

  it('does NOT set winnerTeamId when penalty scores are equal', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 47,
        utcDate: '2026-06-29T18:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_32',
        group: null,
        homeTeam: { id: 10, name: 'Germany', tla: 'GER' },
        awayTeam: { id: 11, name: 'Paraguay', tla: 'PAR' },
        score: {
          winner: 'DRAW',
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 0, away: 0 },
          fullTime: { home: 0, away: 0 },
          penalties: { home: 3, away: 3 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.winnerTeamId).toBeUndefined();
    expect(m.penaltyHome).toBe(3);
    expect(m.penaltyAway).toBe(3);
  });

  // --- WC2026 live-feed shape (regression for the real bug) ----------------
  // The football-data.org v4 live feed reports finished shootouts with
  // winner:null and an INCOMPLETE, EQUAL `penalties` object (it omits the
  // sudden-death kicks). The decisive aggregate lives in `fullTime`. Verified
  // against live matches 537415 (GER-PAR) and 537418 (NED-MAR).

  it('LIVE WC2026 shape (537415 GER-PAR): winner:null, penalties 4-4, fullTime 4-5 -> away (PAR) wins, shows 4-5', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 537415,
        utcDate: '2026-06-29T20:30:00Z',
        status: 'FINISHED',
        stage: 'LAST_32',
        group: null,
        homeTeam: { id: 759, name: 'Germany', tla: 'GER' },
        awayTeam: { id: 761, name: 'Paraguay', tla: 'PAR' },
        score: {
          winner: null,
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 1, away: 1 },
          extraTime: { home: 0, away: 0 },
          penalties: { home: 4, away: 4 }, // EQUAL + incomplete
          fullTime: { home: 4, away: 5 },  // decisive carrier
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.status).toBe('finished');
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    // 90/120-min displayed score stays the regulation 1-1.
    expect(m.homeScore).toBe(1);
    expect(m.awayScore).toBe(1);
    // Decisive winner derived from fullTime: away (Paraguay) advanced.
    expect(m.winnerTeamId).toBe('PAR');
    // Displayed shootout score is the correct decisive 4-5, NOT the stale 4-4.
    expect(m.penaltyHome).toBe(4);
    expect(m.penaltyAway).toBe(5);
  });

  it('LIVE WC2026 shape (537418 NED-MAR): winner:null, penalties 3-3, fullTime 3-4 -> away (MAR) wins, shows 3-4', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 537418,
        utcDate: '2026-06-29T16:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_32',
        group: null,
        homeTeam: { id: 8601, name: 'Netherlands', tla: 'NED' },
        awayTeam: { id: 815, name: 'Morocco', tla: 'MAR' },
        score: {
          winner: null,
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 1, away: 1 },
          extraTime: { home: 0, away: 0 },
          penalties: { home: 3, away: 3 },
          fullTime: { home: 3, away: 4 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.winnerTeamId).toBe('MAR');
    expect(m.penaltyHome).toBe(3);
    expect(m.penaltyAway).toBe(4);
  });

  it('GUARD: a genuinely undecided shootout (winner:null, penalties & fullTime both equal) derives no winner', () => {
    const resp: FootballDataResponse = {
      matches: [{
        id: 999,
        utcDate: '2026-06-29T18:00:00Z',
        status: 'FINISHED',
        stage: 'LAST_32',
        group: null,
        homeTeam: { id: 10, name: 'Germany', tla: 'GER' },
        awayTeam: { id: 11, name: 'Paraguay', tla: 'PAR' },
        score: {
          winner: null,
          duration: 'PENALTY_SHOOTOUT',
          regularTime: { home: 1, away: 1 },
          extraTime: { home: 0, away: 0 },
          penalties: { home: 4, away: 4 },
          fullTime: { home: 4, away: 4 },
        },
      }],
    };
    const [m] = parseFootballData(resp);
    expect(m.decidedBy).toBe('PENALTY_SHOOTOUT');
    expect(m.winnerTeamId).toBeUndefined();
    expect(m.penaltyHome).toBe(4);
    expect(m.penaltyAway).toBe(4);
  });
});
