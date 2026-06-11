import { describe, it, expect } from 'vitest';
import { selectDashboardState } from '../src/shared/selectDashboardState.js';
import type { DashboardData, Match } from '../src/shared/types.js';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'kickoffUtc' | 'status'>): Match {
  return {
    stage: 'group',
    group: 'A',
    homeTeam: { id: 'AAA', name: 'Team A' },
    awayTeam: { id: 'BBB', name: 'Team B' },
    ...partial,
  };
}

function data(matches: Match[], phase: DashboardData['tournamentPhase'] = 'group'): DashboardData {
  return {
    generatedAtUtc: '2026-06-11T18:00:00Z',
    tournamentPhase: phase,
    matches,
    standings: [
      {
        group: 'A', team: { id: 'AAA', name: 'Team A' },
        played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0,
        goalDifference: 2, points: 3, rank: 1,
      },
      {
        group: 'B', team: { id: 'CCC', name: 'Team C' },
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
        goalDifference: 0, points: 0, rank: 1,
      },
    ],
    bracket: [],
  };
}

const now = new Date('2026-06-11T18:00:00Z');

describe('selectDashboardState', () => {
  it('uses a live match as the hero', () => {
    const live = match({ id: 'm1', kickoffUtc: '2026-06-11T17:00:00Z', status: 'live', minute: 55 });
    const next = match({ id: 'm2', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([next, live]), now);
    expect(view.heroMatch?.id).toBe('m1');
    expect(view.liveMatches).toHaveLength(1);
  });

  it('falls back to the next upcoming match when nothing is live', () => {
    const past = match({ id: 'm0', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished' });
    const next = match({ id: 'm2', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const later = match({ id: 'm3', kickoffUtc: '2026-06-11T23:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([later, past, next]), now);
    expect(view.heroMatch?.id).toBe('m2');
    expect(view.nextMatch?.id).toBe('m2');
  });

  it('features the hero match group standings during group stage', () => {
    const hero = match({ id: 'm1', group: 'A', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([hero]), now);
    expect(view.showBracket).toBe(false);
    expect(view.featuredGroup).toBe('A');
    expect(view.featuredStandings.every((s) => s.group === 'A')).toBe(true);
  });

  it('shows the bracket during the knockout phase', () => {
    const hero = match({ id: 'm1', stage: 'round_of_16', group: undefined, kickoffUtc: '2026-06-20T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([hero], 'knockout'), now);
    expect(view.showBracket).toBe(true);
    expect(view.featuredGroup).toBeUndefined();
  });

  it('buckets today vs recent results correctly', () => {
    const recent = match({ id: 'm0', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const tomorrow = match({ id: 'm9', kickoffUtc: '2026-06-12T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([recent, tomorrow]), now);
    expect(view.recentResults.map((m) => m.id)).toContain('m0');
    expect(view.todayMatches.map((m) => m.id)).toContain('m0');
    expect(view.todayMatches.map((m) => m.id)).not.toContain('m9');
  });
});
