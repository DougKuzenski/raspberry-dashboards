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
