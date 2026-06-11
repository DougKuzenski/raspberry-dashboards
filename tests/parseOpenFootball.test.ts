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
  });
});
