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
