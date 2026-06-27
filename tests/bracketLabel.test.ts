import { describe, expect, it } from 'vitest';
import { formatBracketSource } from '../src/client/components/bracketLabel.js';

describe('formatBracketSource', () => {
  it.each([
    ['Winner Group B', 'GRP B #1'],
    ['Runner-up Group L', 'GRP L #2'],
    ['Best 3rd #1', '3RD #1'],
    ['Winner R32-1', 'W R32-1'],
    ['Loser SF-2', 'L SF-2'],
  ])('formats %s as %s', (source, expected) => {
    expect(formatBracketSource(source)).toBe(expected);
  });

  it('passes an unrecognized source through unchanged', () => {
    expect(formatBracketSource('TBD by FIFA')).toBe('TBD by FIFA');
  });
});
