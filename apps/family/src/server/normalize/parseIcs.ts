// Minimal, dependency-free iCalendar (RFC 5545) parser, scoped to what a family
// dashboard needs: VEVENTs with timed/all-day starts, TZID wall-times, and basic
// DAILY/WEEKLY recurrence expanded into a date window. MONTHLY/YEARLY rules emit
// only their base occurrence for now (see BACKLOG).
import type { CalEvent } from '../../shared/types.js';
import { DEFAULT_TIMEZONE } from '../../shared/constants.js';

export interface ParseIcsOptions {
  sourceId: string;
  windowStartMs: number;
  windowEndMs: number;
  defaultTz?: string;
  /** Cap on expanded occurrences per recurring event (safety valve). */
  maxOccurrences?: number;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_MS = 86_400_000;

// Offset (ms) of a timezone at a given instant, via Intl — no tz database dep.
function tzOffsetMs(instant: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instant;
}

// A wall-clock time in `tz` -> the UTC instant (ms). DST-correct for our needs.
function wallToInstant(
  y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string,
): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  return guess - tzOffsetMs(guess, tz);
}

// Unfold RFC 5545 line folding (continuation lines begin with space/tab).
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
    else out.push(line);
  }
  return out;
}

interface RawProp { params: Record<string, string>; value: string; }

function parseLine(line: string): { name: string; prop: RawProp } | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(';');
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), prop: { params, value } };
}

interface DateValue { allDay: boolean; date?: string; instant?: number; wall?: number[]; tz?: string; }

function parseDateValue(prop: RawProp, defaultTz: string): DateValue {
  const v = prop.value.trim();
  if (prop.params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    return { allDay: true, date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { allDay: true, date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  const [, y, mo, d, h, mi, s, z] = m;
  const nums = [+y, +mo, +d, +h, +mi, +s];
  if (z) return { allDay: false, instant: Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5]) };
  const tz = prop.params.TZID || defaultTz;
  return { allDay: false, wall: nums, tz, instant: wallToInstant(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5], tz) };
}

function parseRRule(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).toUpperCase();
  }
  return out;
}

function untilMs(until: string | undefined): number | undefined {
  if (!until) return undefined;
  const m = until.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return undefined;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 23), +(m[5] ?? 59), +(m[6] ?? 59));
}

interface VEvent {
  uid?: string; summary?: string; location?: string; transp?: string;
  dtstart?: RawProp; dtend?: RawProp; rrule?: string;
}

export function parseIcs(text: string, opts: ParseIcsOptions): CalEvent[] {
  const defaultTz = opts.defaultTz ?? DEFAULT_TIMEZONE;
  const maxOcc = opts.maxOccurrences ?? 200;
  const lines = unfold(text);

  const vevents: VEvent[] = [];
  let cur: VEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') { if (cur) vevents.push(cur); cur = null; }
    else if (cur) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const { name, prop } = parsed;
      if (name === 'UID') cur.uid = prop.value;
      else if (name === 'SUMMARY') cur.summary = prop.value;
      else if (name === 'LOCATION') cur.location = prop.value;
      else if (name === 'TRANSP') cur.transp = prop.value;
      else if (name === 'DTSTART') cur.dtstart = prop;
      else if (name === 'DTEND') cur.dtend = prop;
      else if (name === 'RRULE') cur.rrule = prop.value;
    }
  }

  const out: CalEvent[] = [];
  for (const ve of vevents) {
    if (!ve.dtstart) continue;
    const start = parseDateValue(ve.dtstart, defaultTz);
    const end = ve.dtend ? parseDateValue(ve.dtend, defaultTz) : undefined;
    const base = {
      source: opts.sourceId,
      title: unescapeText(ve.summary ?? '(no title)'),
      location: ve.location ? unescapeText(ve.location) : undefined,
      tentative: ve.transp === 'TRANSPARENT' || undefined,
      kind: /flight|\bAS ?\d|→/i.test(ve.summary ?? '') ? ('flight' as const) : undefined,
    };

    const occurrences = expandOccurrences(start, end, ve.rrule, opts, maxOcc);
    occurrences.forEach((occ, i) => {
      const id = `${ve.uid ?? base.title}-${occ.allDay ? occ.date : occ.start}-${i}`;
      out.push({ id, allDay: occ.allDay, date: occ.date, endDate: occ.endDate, start: occ.start, end: occ.end, ...base });
    });
  }
  return out;
}

interface Occurrence { allDay: boolean; date?: string; endDate?: string; start?: string; end?: string; }

function expandOccurrences(
  start: DateValue, end: DateValue | undefined, rrule: string | undefined,
  opts: ParseIcsOptions, maxOcc: number,
): Occurrence[] {
  const inWindow = (s: number, e: number) => e >= opts.windowStartMs && s < opts.windowEndMs;

  // Build a single occurrence shifted by `dayOffset` days from the base.
  const make = (dayOffset: number): Occurrence | null => {
    if (start.allDay) {
      const date = shiftDate(start.date!, dayOffset);
      const endDate = end?.date ? shiftDate(end.date, dayOffset) : undefined;
      const s = Date.parse(`${date}T00:00:00Z`);
      const e = endDate ? Date.parse(`${endDate}T00:00:00Z`) : s + DAY_MS;
      return inWindow(s, e) ? { allDay: true, date, endDate } : null;
    }
    // timed: recompute the instant per date so DST shifts are handled.
    const [y, mo, d, h, mi, s] = start.wall ?? utcParts(start.instant!);
    const base = new Date(`${pad4(y)}-${pad2(mo)}-${pad2(d)}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + dayOffset);
    const tz = start.tz;
    const startMs = tz
      ? wallToInstant(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi, s, tz)
      : start.instant! + dayOffset * DAY_MS;
    const durMs = end?.instant != null ? end.instant - start.instant! : 0;
    const endMs = startMs + durMs;
    return inWindow(startMs, endMs)
      ? { allDay: false, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() }
      : null;
  };

  if (!rrule) {
    const occ = make(0);
    return occ ? [occ] : [];
  }

  const r = parseRRule(rrule);
  const freq = r.FREQ;
  if (freq !== 'DAILY' && freq !== 'WEEKLY') {
    const occ = make(0); // unsupported freq -> base occurrence only
    return occ ? [occ] : [];
  }
  const interval = Math.max(1, Number(r.INTERVAL || 1));
  const count = r.COUNT ? Number(r.COUNT) : undefined;
  const until = untilMs(r.UNTIL);
  const byDay = r.BYDAY ? r.BYDAY.split(',').map((d) => d.trim()) : undefined;

  // Base the recurrence on the event's *wall* date (its own timezone), not the
  // UTC date of the instant — otherwise an evening TZID event rolls to the next
  // UTC day and BYDAY/weekday math is off by one.
  const baseParts = start.wall ?? (start.instant != null ? utcParts(start.instant) : undefined)!;
  const baseDateKey = start.allDay ? start.date! : `${pad4(baseParts[0])}-${pad2(baseParts[1])}-${pad2(baseParts[2])}`;
  const baseDate = new Date(`${baseDateKey}T00:00:00Z`);
  const baseWeekday = baseDate.getUTCDay();

  const occs: Occurrence[] = [];
  let emitted = 0;
  const hardCap = Math.min(800, (opts.windowEndMs - baseDate.getTime()) / DAY_MS + 2);
  for (let off = 0; off <= hardCap && emitted < maxOcc; off++) {
    const day = new Date(baseDate.getTime() + off * DAY_MS);
    const dow = day.getUTCDay();
    const weeksFromBase = Math.floor((day.getTime() - startOfWeek(baseDate)) / (7 * DAY_MS));

    let matches = false;
    if (freq === 'DAILY') matches = off % interval === 0;
    else if (byDay) matches = byDay.includes(WEEKDAYS[dow]) && weeksFromBase % interval === 0;
    else matches = dow === baseWeekday && weeksFromBase % interval === 0;
    if (!matches) continue;

    if (until != null && day.getTime() > until) break;
    if (count != null && emitted >= count) break;
    emitted++;

    if (day.getTime() >= opts.windowEndMs) break;
    const occ = make(off);
    if (occ) occs.push(occ);
  }
  return occs;
}

// ---- small date helpers (civil-date / UTC math) ----
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function pad4(n: number): string { return String(n).padStart(4, '0'); }
function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function utcParts(ms: number): number[] {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
}
function startOfWeek(d: Date): number { return d.getTime() - d.getUTCDay() * DAY_MS; }
function unescapeText(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
