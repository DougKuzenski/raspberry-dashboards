// Timezone-aware formatting helpers. Always store UTC, render in the target zone
// using Intl.DateTimeFormat rather than manual offset math.
import { DEFAULT_TIMEZONE } from './constants.js';

/** "Thu 5:00 PM" — short weekday + local kickoff time. */
export function formatKickoffPacific(utc: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(utc));
}

/** "5:00 PM" — just the local time-of-day. */
export function formatTimeOfDay(utc: string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(utc));
}

/** "PDT" / "EST" / "GMT+1" — short zone label for the configured timezone. */
export function timeZoneAbbrev(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(
    date,
  );
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** "Thu Jun 11" — header date line. */
export function formatHeaderDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** "3:24" — header wall clock (24h-free, no seconds). */
export function formatHeaderClock(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * The civil calendar day (in the target zone) for an instant, as YYYY-MM-DD.
 * Used to decide whether two instants fall on the "same day" locally.
 */
export function localDayKey(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  // en-CA yields YYYY-MM-DD which sorts and compares cleanly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isSameLocalDay(a: Date, b: Date, timeZone = DEFAULT_TIMEZONE): boolean {
  return localDayKey(a, timeZone) === localDayKey(b, timeZone);
}

/**
 * The local calendar day immediately after `date`'s local day, as YYYY-MM-DD.
 * Derived from the civil date string (not +24h arithmetic) so it stays correct
 * across DST transitions.
 */
function nextLocalDayKey(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const [y, m, d] = localDayKey(date, timeZone).split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * True when `date` falls on the same local day as `now` OR the next local day —
 * the "today + tomorrow" window (in the target zone). Compares civil-day keys, so
 * it's DST-safe and avoids hand-rolled offset math.
 */
export function isTodayOrTomorrowLocal(
  date: Date,
  now: Date = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): boolean {
  const key = localDayKey(date, timeZone);
  return key === localDayKey(now, timeZone) || key === nextLocalDayKey(now, timeZone);
}

/**
 * Label for an upcoming kickoff: just the time ("5:00 PM") when it's today in
 * the target zone, otherwise weekday + time ("Fri 9:00 AM"). Keeps today's
 * matches reading as imminent rather than buried under a redundant weekday.
 */
export function formatUpcomingLabel(
  utc: string,
  now: Date = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): string {
  const kickoff = new Date(utc);
  return isSameLocalDay(kickoff, now, timeZone)
    ? formatTimeOfDay(utc, timeZone)
    : formatKickoffPacific(utc, timeZone);
}

/**
 * Human countdown to a future instant: "1h 36m", "12m", or "now".
 * Returns undefined when the instant is in the past.
 */
export function formatCountdown(targetUtc: string, now: Date = new Date()): string | undefined {
  const diffMs = new Date(targetUtc).getTime() - now.getTime();
  if (diffMs <= 0) return undefined;
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes <= 0) return 'now';
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
