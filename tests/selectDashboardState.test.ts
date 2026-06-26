import { describe, it, expect } from 'vitest';
import {
  selectDashboardState,
  deriveContextPhase,
} from '../src/shared/selectDashboardState.js';
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

  it('exposes a transition context phase once the bracket starts forming', () => {
    // Group B fully decided, group A still playing -> transition.
    const decided = match({ id: 'b1', group: 'B', kickoffUtc: '2026-06-10T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const playing = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([decided, playing]), now);
    expect(view.contextPhase).toBe('transition');
    expect(view.showBracket).toBe(false);
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

describe('deriveContextPhase', () => {
  it("stays 'group' while every group is still mid-play and no knockout is scheduled", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const a2 = match({ id: 'a2', group: 'A', kickoffUtc: '2026-06-14T15:00:00Z', status: 'scheduled' });
    const b1 = match({ id: 'b1', group: 'B', kickoffUtc: '2026-06-12T15:00:00Z', status: 'scheduled' });
    expect(deriveContextPhase([a1, a2, b1])).toBe('group');
  });

  it("enters 'transition' once one group is mathematically decided", () => {
    // Group A's only match is finished (decided); group B still has a game left.
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    const b1 = match({ id: 'b1', group: 'B', kickoffUtc: '2026-06-12T15:00:00Z', status: 'scheduled' });
    expect(deriveContextPhase([a1, b1])).toBe('transition');
  });

  it("enters 'transition' once a knockout match is scheduled, even with no group decided", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-12T15:00:00Z', status: 'scheduled' });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    expect(deriveContextPhase([a1, r32])).toBe('transition');
  });

  it("enters full 'knockout' once no group match remains unfinished", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    expect(deriveContextPhase([a1, r32])).toBe('knockout');
  });

  it("treats a cancelled group match as not blocking knockout", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const a2 = match({ id: 'a2', group: 'A', kickoffUtc: '2026-06-14T15:00:00Z', status: 'cancelled' });
    expect(deriveContextPhase([a1, a2])).toBe('knockout');
  });
});
