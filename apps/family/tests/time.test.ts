import { describe, it, expect } from 'vitest';
import { civilLabel, dayKey, formatTime, sortInstant, timeZoneAbbrev } from '../src/shared/time.js';

describe('time helpers', () => {
  it('formats a timed instant in the display zone', () => {
    expect(formatTime('2026-06-17T19:30:00Z', 'America/Los_Angeles')).toBe('12:30 PM');
  });

  it('labels an all-day civil date with no timezone shift', () => {
    // The classic bug: 2026-06-13 must read as Sat Jun 13, never Jun 12.
    expect(civilLabel('2026-06-13')).toBe('Sat, Jun 13');
  });

  it('computes the civil day in the display zone', () => {
    // 2026-06-13T02:00Z is still June 12 in Los Angeles.
    expect(dayKey(new Date('2026-06-13T02:00:00Z'), 'America/Los_Angeles')).toBe('2026-06-12');
  });

  it('orders all-day events to the start of their day', () => {
    const allDay = sortInstant({ id: 'a', source: 's', title: 'x', allDay: true, date: '2026-06-13' });
    const timed = sortInstant({ id: 'b', source: 's', title: 'y', allDay: false, start: '2026-06-13T16:00:00Z' });
    expect(allDay).toBeLessThan(timed);
  });

  it('derives a short zone abbreviation', () => {
    expect(timeZoneAbbrev(new Date('2026-06-17T19:30:00Z'), 'America/Los_Angeles')).toBe('PDT');
  });
});
