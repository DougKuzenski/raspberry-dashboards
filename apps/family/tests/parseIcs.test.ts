import { describe, it, expect } from 'vitest';
import { parseIcs } from '../src/server/normalize/parseIcs.js';

const WINDOW = {
  sourceId: 'family',
  windowStartMs: Date.parse('2026-06-10T00:00:00Z'),
  windowEndMs: Date.parse('2026-07-15T00:00:00Z'),
  defaultTz: 'America/Los_Angeles',
};

function ics(body: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;
}

describe('parseIcs', () => {
  it('parses an all-day event as a civil date (no timezone shift)', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:a\nSUMMARY:Grandma visits\nDTSTART;VALUE=DATE:20260613\nDTEND;VALUE=DATE:20260614\nEND:VEVENT',
    ), WINDOW);
    expect(out).toHaveLength(1);
    expect(out[0].allDay).toBe(true);
    expect(out[0].date).toBe('2026-06-13');
  });

  it('parses a TZID wall-time into the correct UTC instant (PDT = UTC-7)', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:b\nSUMMARY:Recital\nDTSTART;TZID=America/Los_Angeles:20260617T123000\nDTEND;TZID=America/Los_Angeles:20260617T131500\nEND:VEVENT',
    ), WINDOW);
    expect(out[0].allDay).toBe(false);
    expect(out[0].start).toBe('2026-06-17T19:30:00.000Z');
    expect(out[0].end).toBe('2026-06-17T20:15:00.000Z');
  });

  it('parses a UTC (Z) datetime directly and flags free/transparent as tentative', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:c\nSUMMARY:Field trip\nDTSTART:20260615T160000Z\nDTEND:20260615T210000Z\nTRANSP:TRANSPARENT\nEND:VEVENT',
    ), WINDOW);
    expect(out[0].start).toBe('2026-06-15T16:00:00.000Z');
    expect(out[0].tentative).toBe(true);
  });

  it('expands a weekly recurrence within the window and honors COUNT', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:d\nSUMMARY:Soccer practice\nDTSTART;TZID=America/Los_Angeles:20260611T170000\nDTEND;TZID=America/Los_Angeles:20260611T180000\nRRULE:FREQ=WEEKLY;BYDAY=TH;COUNT=3\nEND:VEVENT',
    ), WINDOW);
    // Three Thursdays at 5pm PDT (== 00:00Z the next day).
    expect(out).toHaveLength(3);
    expect(out.map((e) => e.start)).toEqual([
      '2026-06-12T00:00:00.000Z',
      '2026-06-19T00:00:00.000Z',
      '2026-06-26T00:00:00.000Z',
    ]);
  });

  it('decodes escaped commas in the summary', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:e\nSUMMARY:Dinner\\, then a movie\nDTSTART:20260612T020000Z\nEND:VEVENT',
    ), WINDOW);
    expect(out[0].title).toBe('Dinner, then a movie');
  });

  it('unfolds RFC 5545 folded continuation lines', () => {
    // A continuation line begins with a space; that space is the fold marker and
    // is removed, so the second space here is the real word break.
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:e2\nSUMMARY:Soccer practice at the\n  big field\nDTSTART:20260612T020000Z\nEND:VEVENT',
    ), WINDOW);
    expect(out[0].title).toBe('Soccer practice at the big field');
  });

  it('ignores events entirely outside the window', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:f\nSUMMARY:Old\nDTSTART:20240101T120000Z\nDTEND:20240101T130000Z\nEND:VEVENT',
    ), WINDOW);
    expect(out).toHaveLength(0);
  });

  // Regression: caps were relative to DTSTART, so recurring events created long
  // before the window produced ZERO occurrences (a weekly practice from 2024
  // vanished from a 2026 board). The scan must reach the window regardless of
  // how old the event is.
  it('surfaces a weekly event created years before the window', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:g\nSUMMARY:Soccer\nDTSTART;TZID=America/Los_Angeles:20240104T170000\nDTEND;TZID=America/Los_Angeles:20240104T180000\nRRULE:FREQ=WEEKLY;BYDAY=TH\nEND:VEVENT',
    ), { ...WINDOW, windowEndMs: Date.parse('2026-06-20T00:00:00Z') });
    // Thursdays Jun 11 + Jun 18 2026, 5pm PDT.
    expect(out.map((e) => e.start)).toEqual([
      '2026-06-12T00:00:00.000Z',
      '2026-06-19T00:00:00.000Z',
    ]);
  });

  it('surfaces a daily event older than the per-event occurrence cap', () => {
    const out = parseIcs(ics(
      'BEGIN:VEVENT\nUID:h\nSUMMARY:Standup\nDTSTART:20250610T160000Z\nDTEND:20250610T161500Z\nRRULE:FREQ=DAILY\nEND:VEVENT',
    ), { ...WINDOW, windowEndMs: Date.parse('2026-06-20T00:00:00Z') });
    // ~366 pre-window occurrences must not consume the emit budget.
    expect(out.length).toBe(10);
    expect(out[0].start).toBe('2026-06-10T16:00:00.000Z');
  });
});
