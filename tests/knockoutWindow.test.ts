import { describe, it, expect } from 'vitest';
import {
  KNOCKOUT_ROUND_ORDER,
  roundPairingsSet,
  roundStarted,
  roundComplete,
  selectKnockoutWindow,
} from '../src/shared/knockoutWindow.js';
import type { ResolvedBracketNode, Stage } from '../src/shared/types.js';

// A node is one of three states for window purposes:
//   placeholder = no real teams yet (decided=false)
//   set         = both teams resolved, no winner (decided=true)
//   won         = both teams resolved AND a winner exists
type NodeState = 'placeholder' | 'set' | 'won';

function team(name: string) {
  return { id: name, name };
}

function makeNode(stage: Stage, i: number, state: NodeState): ResolvedBracketNode {
  const decided = state !== 'placeholder';
  const home = team(`${stage}-H${i}`);
  const away = team(`${stage}-A${i}`);
  return {
    id: `${stage}-${i}`,
    stage,
    label: `${stage} ${i}`,
    home: { source: 'Winner X', team: decided ? home : undefined, isWinner: state === 'won' },
    away: { source: 'Winner Y', team: decided ? away : undefined, isWinner: false },
    winner: state === 'won' ? home : undefined,
    decided,
  };
}

function makeRound(stage: Stage, count: number, state: NodeState): ResolvedBracketNode[] {
  return Array.from({ length: count }, (_, i) => makeNode(stage, i, state));
}

// Build a round with the first `wonCount` nodes won, the rest `rest`.
function partialRound(
  stage: Stage,
  count: number,
  wonCount: number,
  rest: NodeState,
): ResolvedBracketNode[] {
  return Array.from({ length: count }, (_, i) => makeNode(stage, i, i < wonCount ? 'won' : rest));
}

// Assemble a full bracket from per-round node lists, with a third-place node added
// so we can assert the window never includes it.
function bracket(rounds: Partial<Record<Stage, ResolvedBracketNode[]>>): ResolvedBracketNode[] {
  const order: Stage[] = [
    'round_of_32',
    'round_of_16',
    'quarterfinal',
    'semifinal',
    'third_place',
    'final',
  ];
  return order.flatMap((s) => rounds[s] ?? []);
}

describe('round predicates', () => {
  it('roundPairingsSet: true only when every node has both teams', () => {
    expect(roundPairingsSet(makeRound('round_of_16', 8, 'set'))).toBe(true);
    expect(roundPairingsSet(makeRound('round_of_16', 8, 'won'))).toBe(true);
    expect(
      roundPairingsSet([...makeRound('round_of_16', 7, 'set'), makeNode('round_of_16', 7, 'placeholder')]),
    ).toBe(false);
    expect(roundPairingsSet([])).toBe(false);
  });

  it('roundStarted: true once at least one node has a winner', () => {
    expect(roundStarted(makeRound('quarterfinal', 4, 'set'))).toBe(false);
    expect(roundStarted(partialRound('quarterfinal', 4, 1, 'set'))).toBe(true);
    expect(roundStarted([])).toBe(false);
  });

  it('roundComplete: true only when every node has a winner', () => {
    expect(roundComplete(makeRound('semifinal', 2, 'won'))).toBe(true);
    expect(roundComplete(partialRound('semifinal', 2, 1, 'set'))).toBe(false);
    expect(roundComplete(makeRound('semifinal', 2, 'set'))).toBe(false);
    expect(roundComplete([])).toBe(false);
  });
});

describe('selectKnockoutWindow', () => {
  it('shows only R32 before any R32 result (pairings set, none played)', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'set'),
      round_of_16: makeRound('round_of_16', 8, 'placeholder'),
      quarterfinal: makeRound('quarterfinal', 4, 'placeholder'),
      semifinal: makeRound('semifinal', 2, 'placeholder'),
      final: makeRound('final', 1, 'placeholder'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['round_of_32']);
  });

  it('shows R32 + R16 once the first R32 match has a winner', () => {
    const b = bracket({
      round_of_32: partialRound('round_of_32', 16, 1, 'set'),
      round_of_16: makeRound('round_of_16', 8, 'placeholder'),
      final: makeRound('final', 1, 'placeholder'),
    });
    // ascending order: current (R32) on the left, next (R16) on the right.
    expect(selectKnockoutWindow(b)).toEqual(['round_of_32', 'round_of_16']);
  });

  it('drops R32 once it is complete; shows R16 alone until R16 starts', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'set'),
      quarterfinal: makeRound('quarterfinal', 4, 'placeholder'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['round_of_16']);
  });

  it('shows R16 + QF once R16 has started (mid window)', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: partialRound('round_of_16', 8, 3, 'set'),
      quarterfinal: makeRound('quarterfinal', 4, 'placeholder'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['round_of_16', 'quarterfinal']);
  });

  it('shows QF + SF once QF has started', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'won'),
      quarterfinal: partialRound('quarterfinal', 4, 1, 'set'),
      semifinal: makeRound('semifinal', 2, 'placeholder'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['quarterfinal', 'semifinal']);
  });

  it('shows SF + Final once SF has started', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'won'),
      quarterfinal: makeRound('quarterfinal', 4, 'won'),
      semifinal: partialRound('semifinal', 2, 1, 'set'),
      final: makeRound('final', 1, 'placeholder'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['semifinal', 'final']);
  });

  it('shows the Final alone once SF is complete but the Final has not started', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'won'),
      quarterfinal: makeRound('quarterfinal', 4, 'won'),
      semifinal: makeRound('semifinal', 2, 'won'),
      final: makeRound('final', 1, 'set'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['final']);
  });

  it('shows the Final alone when every round is complete', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'won'),
      quarterfinal: makeRound('quarterfinal', 4, 'won'),
      semifinal: makeRound('semifinal', 2, 'won'),
      final: makeRound('final', 1, 'won'),
    });
    expect(selectKnockoutWindow(b)).toEqual(['final']);
  });

  it('never includes the third-place node in the window', () => {
    const b = bracket({
      round_of_32: makeRound('round_of_32', 16, 'won'),
      round_of_16: makeRound('round_of_16', 8, 'won'),
      quarterfinal: makeRound('quarterfinal', 4, 'won'),
      semifinal: partialRound('semifinal', 2, 1, 'set'),
      third_place: makeRound('third_place', 1, 'placeholder'),
      final: makeRound('final', 1, 'placeholder'),
    });
    const win = selectKnockoutWindow(b);
    expect(win).not.toContain('third_place');
    expect(win).toEqual(['semifinal', 'final']);
  });

  it('returns nothing for an empty bracket', () => {
    expect(selectKnockoutWindow([])).toEqual([]);
  });

  it('orders the window left -> right ascending by KNOCKOUT_ROUND_ORDER', () => {
    const b = bracket({
      round_of_32: partialRound('round_of_32', 16, 1, 'set'),
      round_of_16: makeRound('round_of_16', 8, 'placeholder'),
    });
    const win = selectKnockoutWindow(b);
    const idx = win.map((s) => KNOCKOUT_ROUND_ORDER.indexOf(s));
    expect(idx).toEqual([...idx].sort((a, b2) => a - b2));
  });
});
