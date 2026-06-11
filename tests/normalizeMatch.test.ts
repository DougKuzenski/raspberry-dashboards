import { describe, it, expect } from 'vitest';
import { normalizeMatch, type RemoteMatch } from '../src/server/normalize/normalizeMatch.js';

const remote: RemoteMatch = {
  id: 'm1',
  stage: 'group',
  group: 'A',
  home: { code: 'MEX', name: 'Mexico', flag: '🇲🇽' },
  away: { code: 'RSA', name: 'South Africa' },
  kickoff: '2026-06-11T19:00:00Z',
  state: 'ft',
  homeGoals: 2,
  awayGoals: 1,
  minute: 90,
};

describe('normalizeMatch', () => {
  it('maps remote shape and resolves the winner on a finished match', () => {
    const m = normalizeMatch(remote);
    expect(m.status).toBe('finished');
    expect(m.homeTeam.id).toBe('MEX');
    expect(m.awayTeam.shortName).toBe('RSA'); // falls back to code
    expect(m.winnerTeamId).toBe('MEX');
  });

  it('maps live state and leaves winner undefined', () => {
    const m = normalizeMatch({ ...remote, state: 'live', homeGoals: 1, awayGoals: 1 });
    expect(m.status).toBe('live');
    expect(m.winnerTeamId).toBeUndefined();
  });

  it('falls back to scheduled for unknown states', () => {
    const m = normalizeMatch({ ...remote, state: 'something_weird', homeGoals: null, awayGoals: null });
    expect(m.status).toBe('scheduled');
    expect(m.homeScore).toBeUndefined();
  });
});
