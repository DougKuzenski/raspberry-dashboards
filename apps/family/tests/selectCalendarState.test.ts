import { describe, it, expect } from 'vitest';
import { selectCalendarState } from '../src/shared/selectCalendarState.js';
import type { CalendarData } from '../src/shared/types.js';

const data: CalendarData = {
  generatedAtUtc: '2026-06-12T17:00:00Z',
  timezone: 'America/Los_Angeles',
  sources: [{ id: 'family', label: 'Family', color: '#2dd4bf' }],
  events: [
    { id: 'live', source: 'family', title: 'Park playdate', allDay: false, start: '2026-06-12T16:00:00Z', end: '2026-06-12T20:00:00Z' },
    { id: 'later', source: 'family', title: 'Movie', allDay: false, start: '2026-06-13T02:00:00Z', end: '2026-06-13T03:30:00Z' },
    { id: 'allday', source: 'family', title: 'Grandma', allDay: true, date: '2026-06-13' },
    { id: 'old', source: 'family', title: 'Past', allDay: false, start: '2026-06-01T16:00:00Z', end: '2026-06-01T17:00:00Z' },
  ],
};

// now = 2026-06-12 10:30 AM PDT (during the playdate)
const now = new Date('2026-06-12T17:30:00Z');

describe('selectCalendarState', () => {
  it('finds the event happening now', () => {
    const v = selectCalendarState(data, now);
    expect(v.liveEvent?.id).toBe('live');
  });

  it('picks the next future event across the feed', () => {
    const v = selectCalendarState(data, now);
    expect(v.upNext?.id).toBe('later');
  });

  it('buckets today using the display timezone (the late-evening event is still today)', () => {
    const v = selectCalendarState(data, now);
    // 2026-06-13T02:00Z is 7:00 PM PDT on Jun 12 -> belongs to today.
    expect(v.todayEvents.map((e) => e.id).sort()).toEqual(['later', 'live']);
    expect(v.todayKey).toBe('2026-06-12');
  });

  it('keeps an all-day event on its civil date and surfaces it in the banner', () => {
    const v = selectCalendarState(data, now);
    expect(v.allDayBanner.map((e) => e.id)).toEqual(['allday']);
    const sat = v.weekDays.find((d) => d.key === '2026-06-13');
    expect(sat?.events.some((e) => e.id === 'allday')).toBe(true);
  });

  it('drops past events from the week agenda', () => {
    const v = selectCalendarState(data, now);
    const allIds = v.weekDays.flatMap((d) => d.events.map((e) => e.id));
    expect(allIds).not.toContain('old');
  });
});
