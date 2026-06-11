import { describe, it, expect } from 'vitest';
import { applyToMatch } from '../src/server/normalize/applyManualOverrides.js';
import type { Match } from '../src/shared/types.js';

const base: Match = {
  id: 'm1',
  stage: 'group',
  group: 'A',
  homeTeam: { id: 'MEX', name: 'Mexico' },
  awayTeam: { id: 'RSA', name: 'South Africa' },
  kickoffUtc: '2026-06-11T19:00:00Z',
  status: 'live',
  homeScore: 1,
  awayScore: 0,
  tv: 'Telemundo',
};

describe('applyToMatch (manual overrides)', () => {
  it('overrides channel/notes/time but leaves live score untouched', () => {
    const merged = applyToMatch(base, {
      id: 'm1',
      tv: 'FOX',
      stream: 'FOX One',
      notes: 'Switch to FOX One',
      kickoffUtc: '2026-06-11T19:30:00Z',
    });
    expect(merged.tv).toBe('FOX');
    expect(merged.stream).toBe('FOX One');
    expect(merged.notes).toBe('Switch to FOX One');
    expect(merged.kickoffUtc).toBe('2026-06-11T19:30:00Z');
    // Remote-authoritative fields survive.
    expect(merged.homeScore).toBe(1);
    expect(merged.status).toBe('live');
  });

  it('keeps existing values when an override field is absent', () => {
    const merged = applyToMatch(base, { id: 'm1', notes: 'note only' });
    expect(merged.tv).toBe('Telemundo');
    expect(merged.notes).toBe('note only');
  });

  it('corrects a team display name without touching its id', () => {
    const merged = applyToMatch(base, { id: 'm1', homeTeamName: 'México' });
    expect(merged.homeTeam.name).toBe('México');
    expect(merged.homeTeam.id).toBe('MEX');
  });
});
