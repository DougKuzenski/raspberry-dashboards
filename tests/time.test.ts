import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  isSameLocalDay,
  localDayKey,
  formatKickoffPacific,
  formatUpcomingLabel,
} from '../src/shared/time.js';

describe('time helpers', () => {
  it('formats a kickoff in Pacific time', () => {
    // 2026-06-11T19:00:00Z == 12:00 PM PDT (UTC-7)
    expect(formatKickoffPacific('2026-06-11T19:00:00Z')).toBe('Thu 12:00 PM');
  });

  it('computes the local civil day in Pacific time', () => {
    // 2026-06-12T02:00:00Z is still June 11 in Los Angeles (UTC-7).
    expect(localDayKey(new Date('2026-06-12T02:00:00Z'))).toBe('2026-06-11');
  });

  it('treats two instants on the same Pacific day as equal', () => {
    const a = new Date('2026-06-11T19:00:00Z'); // noon PT
    const b = new Date('2026-06-12T05:59:00Z'); // 10:59 PM PT same day
    expect(isSameLocalDay(a, b)).toBe(true);
  });

  it('drops the weekday for an upcoming match that is today (Pacific)', () => {
    const now = new Date('2026-06-11T17:00:00Z'); // ~10am PT June 11
    // Same Pacific day -> time only.
    expect(formatUpcomingLabel('2026-06-11T19:00:00Z', now)).toBe('12:00 PM');
    // Different Pacific day -> weekday + time.
    expect(formatUpcomingLabel('2026-06-12T16:00:00Z', now)).toBe('Fri 9:00 AM');
  });

  it('formats a countdown and returns undefined for past times', () => {
    const now = new Date('2026-06-11T17:24:00Z');
    expect(formatCountdown('2026-06-11T19:00:00Z', now)).toBe('1h 36m');
    expect(formatCountdown('2026-06-11T17:12:00Z', now)).toBe(undefined);
  });
});
