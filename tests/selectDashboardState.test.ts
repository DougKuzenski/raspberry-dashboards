import { describe, it, expect } from 'vitest';
import {
  selectDashboardState,
  deriveContextPhase,
  shouldShowGroupRankings,
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
  it('reports the live match and the next upcoming match', () => {
    const live = match({ id: 'm1', kickoffUtc: '2026-06-11T17:00:00Z', status: 'live', minute: 55 });
    const next = match({ id: 'm2', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([next, live]), now);
    expect(view.liveMatches.map((m) => m.id)).toEqual(['m1']);
    expect(view.nextMatch?.id).toBe('m2');
  });

  it('reports the next upcoming match when nothing is live', () => {
    const past = match({ id: 'm0', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished' });
    const next = match({ id: 'm2', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const later = match({ id: 'm3', kickoffUtc: '2026-06-11T23:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([later, past, next]), now);
    expect(view.nextMatch?.id).toBe('m2');
  });

  it('features the focus-match group standings during group stage', () => {
    const focus = match({ id: 'm1', group: 'A', kickoffUtc: '2026-06-11T20:00:00Z', status: 'scheduled' });
    const view = selectDashboardState(data([focus]), now);
    expect(view.showBracket).toBe(false);
    expect(view.featuredGroup).toBe('A');
    expect(view.featuredStandings.every((s) => s.group === 'A')).toBe(true);
  });

  it('shows the bracket once a knockout result has landed', () => {
    // Group stage done (no group games) AND a decided R32 match -> knockout phase.
    const r32 = match({ id: 'm1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-06-20T20:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    const view = selectDashboardState(data([r32], 'knockout'), now);
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

  it('fills the today/tomorrow window with finished, live and upcoming games in kickoff order', () => {
    // now = 2026-06-11T18:00Z = 11:00 PDT on Jun 11 (DEFAULT_TIMEZONE).
    const yesterday = match({ id: 'd-1', kickoffUtc: '2026-06-10T20:00:00Z', status: 'finished', homeScore: 0, awayScore: 0 });
    const finishedToday = match({ id: 't0', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const liveToday = match({ id: 't1', kickoffUtc: '2026-06-11T17:30:00Z', status: 'live', minute: 30 });
    const laterToday = match({ id: 't2', kickoffUtc: '2026-06-11T22:00:00Z', status: 'scheduled' });
    // 2026-06-13T05:00Z = 2026-06-12 22:00 PDT -> still local "tomorrow" (Jun 12).
    const lateTomorrow = match({ id: 't3', kickoffUtc: '2026-06-13T05:00:00Z', status: 'scheduled' });
    // 2026-06-13T20:00Z = Jun 13 PDT -> two days out, excluded.
    const dayAfter = match({ id: 'd+2', kickoffUtc: '2026-06-13T20:00:00Z', status: 'scheduled' });

    const view = selectDashboardState(
      data([dayAfter, lateTomorrow, laterToday, liveToday, finishedToday, yesterday]),
      now,
    );
    const ids = view.todayTomorrowMatches.map((m) => m.id);
    expect(ids).toEqual(['t0', 't1', 't2', 't3']); // ascending kickoff, today + tomorrow only
    expect(ids).not.toContain('d-1');
    expect(ids).not.toContain('d+2');
    // The live highlight is unaffected — the live match is still flagged live.
    expect(view.liveMatches.map((m) => m.id)).toContain('t1');
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

  it("stays in 'transition' after the group stage completes but before any R32 result", () => {
    // No group game remains, R32 is scheduled but undecided -> rankings + R32 box.
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    expect(deriveContextPhase([a1, r32])).toBe('transition');
  });

  it("enters full 'knockout' on the first R32 result (group stage complete)", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    expect(deriveContextPhase([a1, r32])).toBe('knockout');
  });

  it("treats a cancelled group match as not blocking the knockout boundary", () => {
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const a2 = match({ id: 'a2', group: 'A', kickoffUtc: '2026-06-14T15:00:00Z', status: 'cancelled' });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'finished', homeScore: 3, awayScore: 0 });
    // The cancelled group game doesn't keep us out of knockout once R32 has a result.
    expect(deriveContextPhase([a1, a2, r32])).toBe('knockout');
  });

  it("stays in 'transition' for a decided NON-R32 match with no R32 result (out-of-order data)", () => {
    // Group stage complete, but the only decided knockout game is a 'final' (and a
    // 'third_place') — no round_of_32 result. The boundary is gated on R32 specifically,
    // so odd/out-of-order data must NOT flip us into 'knockout' early.
    const a1 = match({ id: 'a1', group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status: 'finished', homeScore: 1, awayScore: 0 });
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    const final = match({ id: 'f1', stage: 'final', group: undefined, kickoffUtc: '2026-07-19T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    const third = match({ id: 't1', stage: 'third_place', group: undefined, kickoffUtc: '2026-07-18T15:00:00Z', status: 'finished', homeScore: 0, awayScore: 0 });
    expect(deriveContextPhase([a1, r32, final, third])).toBe('transition');
  });
});

describe('shouldShowGroupRankings', () => {
  const groupA = (id: string, status: Match['status'], hs?: number, as?: number) =>
    match({ id, group: 'A', kickoffUtc: '2026-06-11T15:00:00Z', status, homeScore: hs, awayScore: as });

  it('shows rankings during the group stage', () => {
    expect(shouldShowGroupRankings([groupA('a1', 'scheduled')])).toBe(true);
  });

  it('shows rankings during the transition (group done, no R32 result yet)', () => {
    const a1 = groupA('a1', 'finished', 1, 0);
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    expect(shouldShowGroupRankings([a1, r32])).toBe(true);
  });

  it('hides rankings once the group stage is complete AND the first R32 result lands', () => {
    const a1 = groupA('a1', 'finished', 1, 0);
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    expect(shouldShowGroupRankings([a1, r32])).toBe(false);
  });

  it('still shows rankings if a knockout result somehow precedes the group stage finishing', () => {
    // Group A still has a game to play -> rankings stay even with an R32 result.
    const a1 = groupA('a1', 'finished', 1, 0);
    const a2 = groupA('a2', 'scheduled');
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    expect(shouldShowGroupRankings([a1, a2, r32])).toBe(true);
  });

  it('still shows rankings for a decided NON-R32 match with no R32 result (out-of-order data)', () => {
    // Group stage complete, a 'final' is somehow finished but no round_of_32 result —
    // rankings must stay visible because the R32-gated boundary has not been crossed.
    const a1 = groupA('a1', 'finished', 1, 0);
    const r32 = match({ id: 'r1', stage: 'round_of_32', group: undefined, kickoffUtc: '2026-07-01T15:00:00Z', status: 'scheduled' });
    const final = match({ id: 'f1', stage: 'final', group: undefined, kickoffUtc: '2026-07-19T15:00:00Z', status: 'finished', homeScore: 2, awayScore: 1 });
    expect(shouldShowGroupRankings([a1, r32, final])).toBe(true);
  });
});
