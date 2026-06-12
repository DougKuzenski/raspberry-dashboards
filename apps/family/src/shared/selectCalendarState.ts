// Pure transform from CalendarData -> CalendarView (what the UI renders). Lives
// in shared because the client recomputes it every render against the live clock,
// so "happening now" / "up next" / "today" stay correct between data fetches.
import type { CalEvent, CalendarData, CalendarView, DayGroup } from './types.js';
import { AGENDA_DAYS, DEFAULT_TIMEZONE } from './constants.js';
import { civilLabel, dayKey, eventDayKey, sortInstant } from './time.js';

function isLive(e: CalEvent, nowMs: number): boolean {
  if (e.allDay || !e.start) return false;
  const start = Date.parse(e.start);
  const end = e.end ? Date.parse(e.end) : start;
  return start <= nowMs && end >= nowMs;
}

function isFuture(e: CalEvent, nowMs: number, todayKey: string): boolean {
  return e.allDay ? e.date! > todayKey : Date.parse(e.start!) > nowMs;
}

/** Add `days` to a YYYY-MM-DD key, staying in civil-date space (UTC math). */
function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function selectCalendarState(
  data: CalendarData,
  now: Date = new Date(),
  tz: string = data.timezone || DEFAULT_TIMEZONE,
): CalendarView {
  const nowMs = now.getTime();
  const todayKey = dayKey(now, tz);
  const windowEnd = addDays(todayKey, AGENDA_DAYS);

  const events = [...data.events].sort((a, b) => sortInstant(a, tz) - sortInstant(b, tz));

  const liveEvent = events.find((e) => isLive(e, nowMs));

  const upNext = events.find((e) => isFuture(e, nowMs, todayKey));

  const todayEvents = events.filter((e) => eventDayKey(e, tz) === todayKey);

  // Banner: all-day events from today through the agenda window.
  const allDayBanner = events.filter(
    (e) => e.allDay && e.date! >= todayKey && e.date! < windowEnd,
  );

  // Week agenda: today + future, grouped by civil day, within the window.
  const groups = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = eventDayKey(e, tz);
    if (key < todayKey || key >= windowEnd) continue;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const weekDays: DayGroup[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, evs]) => ({
      key,
      label: key === todayKey ? 'Today' : civilLabel(key),
      events: evs,
    }));

  return { data, sources: data.sources, todayKey, liveEvent, upNext, todayEvents, allDayBanner, weekDays };
}
