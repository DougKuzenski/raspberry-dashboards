import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  isSameLocalDay,
  isTodayOrTomorrowLocal,
  localDayKey,
  formatKickoffPacific,
  formatUpcomingLabel,
  timeZoneAbbrev,
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

  it('includes today and tomorrow (Pacific) in the today-or-tomorrow window', () => {
    const now = new Date('2026-06-11T18:00:00Z'); // 11:00 AM PT, Jun 11
    // Earlier today (already finished) — still in window.
    expect(isTodayOrTomorrowLocal(new Date('2026-06-11T15:00:00Z'), now)).toBe(true);
    // Later today.
    expect(isTodayOrTomorrowLocal(new Date('2026-06-11T22:00:00Z'), now)).toBe(true);
    // Tomorrow.
    expect(isTodayOrTomorrowLocal(new Date('2026-06-12T20:00:00Z'), now)).toBe(true);
    // 2026-06-13T05:00Z == 2026-06-12 22:00 PT -> still local "tomorrow".
    expect(isTodayOrTomorrowLocal(new Date('2026-06-13T05:00:00Z'), now)).toBe(true);
    // Yesterday and two-days-out are excluded.
    expect(isTodayOrTomorrowLocal(new Date('2026-06-10T20:00:00Z'), now)).toBe(false);
    expect(isTodayOrTomorrowLocal(new Date('2026-06-13T20:00:00Z'), now)).toBe(false);
  });

  it('rolls the tomorrow boundary across month end', () => {
    const now = new Date('2026-06-30T18:00:00Z'); // 11:00 AM PT, Jun 30
    expect(isTodayOrTomorrowLocal(new Date('2026-07-01T20:00:00Z'), now)).toBe(true); // Jul 1 PT
    expect(isTodayOrTomorrowLocal(new Date('2026-07-02T20:00:00Z'), now)).toBe(false);
  });

  it('formats a countdown and returns undefined for past times', () => {
    const now = new Date('2026-06-11T17:24:00Z');
    expect(formatCountdown('2026-06-11T19:00:00Z', now)).toBe('1h 36m');
    expect(formatCountdown('2026-06-11T17:12:00Z', now)).toBe(undefined);
  });

  it('renders in a non-default timezone when one is supplied', () => {
    // Same instant: noon PDT == 3:00 PM EDT.
    const utc = '2026-06-11T19:00:00Z';
    expect(formatKickoffPacific(utc, 'America/New_York')).toBe('Thu 3:00 PM');
    // 11:30 PM EDT on the 11th is already the 12th in Pacific.
    const lateEast = new Date('2026-06-12T03:30:00Z');
    expect(localDayKey(lateEast, 'America/New_York')).toBe('2026-06-11');
    expect(localDayKey(lateEast, 'America/Los_Angeles')).toBe('2026-06-11');
  });

  it('derives a short zone abbreviation for the configured timezone', () => {
    const summer = new Date('2026-06-11T19:00:00Z');
    expect(timeZoneAbbrev(summer, 'America/Los_Angeles')).toBe('PDT');
    expect(timeZoneAbbrev(summer, 'America/New_York')).toBe('EDT');
  });
});
