// Timezone-aware formatting + day math. Two rules keep the family board correct:
//  - timed events are instants -> format/bucket them in the display timezone.
//  - all-day events are *civil dates* (YYYY-MM-DD) -> format/bucket them in UTC
//    so an all-day item never slides to the previous day in a western zone.
import type { CalEvent } from './types.js';
import { DEFAULT_TIMEZONE } from './constants.js';

/** "5:00 PM" — local time-of-day for a timed instant. */
export function formatTime(iso: string, tz = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** "Friday, June 12" — header date line. */
export function formatLongDate(d: Date, tz = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/** The civil day (in the given zone) for an instant, as YYYY-MM-DD. */
export function dayKey(d: Date, tz = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** "Sat Jun 13" for a civil YYYY-MM-DD key — formatted in UTC, no day shift. */
export function civilLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

/** Short zone label ("PDT") for the configured timezone. */
export function timeZoneAbbrev(d: Date, tz = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/**
 * "Fri, Jun 12" — the display-zone day label for a timed instant. Never derive
 * this by slicing the ISO string: providers emit different offset forms (manual
 * keeps local offsets, ical emits UTC), and slicing a UTC string mislabels an
 * evening event as the next day.
 */
export function zonedDayLabel(iso: string, tz = DEFAULT_TIMEZONE): string {
  return civilLabel(dayKey(new Date(iso), tz));
}

/** The day-bucket key for any event (timed -> zone day; all-day -> its date). */
export function eventDayKey(e: CalEvent, tz = DEFAULT_TIMEZONE): string {
  return e.allDay ? e.date! : dayKey(new Date(e.start!), tz);
}

// Offset (ms) of a timezone at an instant, via Intl — no tz database dependency.
export function tzOffsetMs(instant: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant;
}

/** The instant of local midnight for a civil date in the given zone. */
export function zonedMidnight(dateKey: string, tz = DEFAULT_TIMEZONE): number {
  const utcMidnight = Date.parse(`${dateKey}T00:00:00Z`);
  return utcMidnight - tzOffsetMs(utcMidnight, tz);
}

/**
 * A chronological instant for ordering events. All-day events order at their
 * local midnight (so they sort ahead of that day's timed events, but not ahead
 * of a sooner timed event on the previous evening).
 */
export function sortInstant(e: CalEvent, tz = DEFAULT_TIMEZONE): number {
  return e.allDay ? zonedMidnight(e.date!, tz) : Date.parse(e.start!);
}

/** "1h 36m", "12m", or "now" until a future instant; undefined once past. */
export function formatCountdown(targetIso: string, now: Date = new Date()): string | undefined {
  const diffMs = Date.parse(targetIso) - now.getTime();
  if (diffMs <= 0) return undefined;
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes <= 0) return 'now';
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
