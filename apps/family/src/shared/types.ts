// Shared data model for the family dashboard. Imported by both the Express
// server and the React client, so keep this dependency-free.

/** A calendar source (one Google calendar), with a display color. */
export interface CalSource {
  id: string;
  label: string;
  color: string;
  /** True when this source failed to load in the current payload (lane is incomplete). */
  failed?: boolean;
}

/**
 * A normalized calendar event.
 *
 * Timed events carry `start`/`end` as ISO instants (with offset). All-day events
 * carry `date` (and optional exclusive `endDate`) as civil YYYY-MM-DD strings and
 * MUST NOT be turned into instants for day math — Google emits all-day events at
 * UTC midnight, so converting them shifts the day in a western timezone.
 */
export interface CalEvent {
  id: string;
  source: string; // CalSource.id
  title: string;
  allDay: boolean;
  // ISO instants (timed). The offset form varies by provider — manual data keeps
  // local offsets, the ical provider emits UTC — so NEVER derive a calendar day
  // by slicing the string; use dayKey()/zonedDayLabel() with the display zone.
  start?: string;
  end?: string;
  date?: string; // YYYY-MM-DD civil date (all-day)
  endDate?: string; // YYYY-MM-DD exclusive end (multi-day all-day)
  location?: string;
  tentative?: boolean; // source marked it Free/transparent
  kind?: 'flight' | 'default';
  highlight?: boolean; // visually featured (e.g. a big milestone)
}

export interface CalendarData {
  generatedAtUtc: string;
  /** IANA timezone the board renders in (e.g. "America/Los_Angeles"). */
  timezone: string;
  sources: CalSource[];
  events: CalEvent[];
  manualMessage?: string;
  /** Provider that produced this payload (e.g. "manual", "ical"). */
  source?: string;
  /** True when serving cached/last-good data after a refresh failed. */
  stale?: boolean;
  /**
   * True when the payload is incomplete — some (but not all) sources failed.
   * Degraded payloads are served (better than blank) but never written to the
   * last-good cache, and the UI surfaces the gap instead of hiding it.
   */
  degraded?: boolean;
}

/** One day's bucket in the week agenda. */
export interface DayGroup {
  key: string; // YYYY-MM-DD
  label: string; // "Today" | "Sat Jun 13"
  events: CalEvent[];
}

// Derived view computed by selectCalendarState — what the UI renders.
export interface CalendarView {
  data: CalendarData;
  sources: CalSource[];
  todayKey: string;
  liveEvent?: CalEvent; // happening right now
  upNext?: CalEvent; // next future event across all sources
  todayEvents: CalEvent[]; // everything today, all-day first
  allDayBanner: CalEvent[]; // upcoming all-day events for the banner
  weekDays: DayGroup[]; // today + future, grouped by day
}
