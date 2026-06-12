import type { CalEvent, CalSource, CalendarView, DayGroup } from '../shared/types.js';
import { formatTime, formatLongDate, formatCountdown, timeZoneAbbrev, civilLabel } from '../shared/time.js';
import { useTimeZone } from './hooks.js';

function colorOf(sources: CalSource[], id: string): string {
  return sources.find((s) => s.id === id)?.color ?? '#64748b';
}

export function Header({ now, weekLabel }: { now: Date; weekLabel: string }) {
  const tz = useTimeZone();
  return (
    <header className="header">
      <div>
        <div className="header__date">{formatLongDate(now, tz)}</div>
        <div className="header__sub">{weekLabel}</div>
      </div>
      <div className="header__clock">
        <div className="header__time">{formatTime(now.toISOString(), tz)}</div>
        <div className="header__zone">{timeZoneAbbrev(now, tz)}</div>
      </div>
    </header>
  );
}

export function Legend({ sources }: { sources: CalSource[] }) {
  return (
    <div className="legend">
      {sources.map((s) => (
        <span key={s.id} className="legend__item">
          <span className="legend__dot" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function NowNext({ live, next, sources }: { live?: CalEvent; next?: CalEvent; sources: CalSource[] }) {
  const tz = useTimeZone();
  return (
    <div className="hero">
      {live ? (
        <div className="card card--now" style={{ ['--accent' as string]: colorOf(sources, live.source) }}>
          <div className="card__eyebrow"><span className="pulse" />HAPPENING NOW</div>
          <div className="card__title">{live.title}</div>
          <div className="card__meta">until {formatTime(live.end ?? live.start!, tz)}{live.location ? ` · ${live.location}` : ''}</div>
        </div>
      ) : (
        <div className="card">
          <div className="card__eyebrow">NOTHING ON RIGHT NOW</div>
          <div className="card__title">Free until the next thing</div>
          <div className="card__meta">enjoy it</div>
        </div>
      )}
      {next ? (
        <div className="card" style={{ ['--accent' as string]: colorOf(sources, next.source) }}>
          <div className="card__eyebrow">UP NEXT</div>
          <div className="card__title">{next.title}</div>
          <div className="card__meta">{nextWhen(next, tz)}{next.location ? ` · ${next.location}` : ''}</div>
        </div>
      ) : (
        <div className="card card--empty"><div className="card__title">Nothing else scheduled</div></div>
      )}
    </div>
  );
}

function nextWhen(e: CalEvent, tz: string): string {
  if (e.allDay) return `${civilLabel(e.date!)} · all day`;
  const countdown = formatCountdown(e.start!, new Date());
  return `${civilLabel(e.start!.slice(0, 10))} · ${formatTime(e.start!, tz)}${countdown ? ` · in ${countdown}` : ''}`;
}

export function AllDayBanner({ events, sources }: { events: CalEvent[]; sources: CalSource[] }) {
  if (events.length === 0) return <div className="allday allday--empty" />;
  return (
    <div className="allday">
      {events.map((e) => (
        <span key={e.id} className="chip" style={{ borderLeftColor: colorOf(sources, e.source) }}>
          <span className="chip__day">{civilLabel(e.date!).split(' ')[0]}</span>
          {e.title}
        </span>
      ))}
    </div>
  );
}

export function EventRow({ event, sources }: { event: CalEvent; sources: CalSource[] }) {
  const tz = useTimeZone();
  const now = Date.now();
  const past = !event.allDay && event.end != null && Date.parse(event.end) < now;
  const cls = ['ev', event.tentative ? 'ev--tentative' : '', event.kind === 'flight' ? 'ev--flight' : '',
    event.highlight ? 'ev--hi' : '', past ? 'ev--past' : ''].join(' ');
  const accent = event.kind === 'flight' ? '#60a5fa' : event.highlight ? '#fb7185' : colorOf(sources, event.source);
  return (
    <div className={cls}>
      <div className="ev__time">
        {event.allDay ? <>All<small>day</small></> : <>{formatTime(event.start!, tz)}<small>{event.end ? formatTime(event.end, tz) : ''}</small></>}
      </div>
      <div>
        <div className="ev__name" style={{ borderLeftColor: accent }}>{event.title}</div>
        {event.location && <div className="ev__where">{event.location}</div>}
      </div>
    </div>
  );
}

export function TodayPanel({ events, sources }: { events: CalEvent[]; sources: CalSource[] }) {
  return (
    <div className="panel">
      <h2 className="panel__title">TODAY</h2>
      {events.length === 0
        ? <p className="panel__empty">Nothing scheduled today.</p>
        : <div>{events.map((e) => <EventRow key={e.id} event={e} sources={sources} />)}</div>}
    </div>
  );
}

export function WeekPanel({ weekDays, sources, todayKey }: { weekDays: DayGroup[]; sources: CalSource[]; todayKey: string }) {
  const future = weekDays.filter((d) => d.key !== todayKey);
  return (
    <div className="panel panel--week">
      <h2 className="panel__title">THE WEEK AHEAD</h2>
      {future.length === 0
        ? <p className="panel__empty">No upcoming events this week.</p>
        : future.map((d) => (
          <div key={d.key} className="daygroup">
            <div className="daygroup__head">{d.label}</div>
            {d.events.map((e) => <EventRow key={e.id} event={e} sources={sources} />)}
          </div>
        ))}
    </div>
  );
}

export function Footer({ view }: { view: CalendarView }) {
  const tz = useTimeZone();
  const hi = view.weekDays.flatMap((d) => d.events).find((e) => e.highlight);
  const msg = view.data.manualMessage
    ?? (hi ? `⭐ ${hi.title} — ${hi.allDay ? civilLabel(hi.date!) : `${civilLabel(hi.start!.slice(0, 10))} ${formatTime(hi.start!, tz)}`}` : 'Have a good week!');
  return (
    <footer className="ticker"><span>{msg}</span></footer>
  );
}

export function ConnectionStatus({ stale, lastUpdated, source }: { stale: boolean; lastUpdated: Date | null; source?: string }) {
  const tz = useTimeZone();
  return (
    <div className={`conn${stale ? ' conn--stale' : ''}`} title={source ? `source: ${source}` : undefined}>
      <span className="conn__dot" />
      <span>{stale ? 'Data stale' : 'Live'}{lastUpdated ? ` · ${formatTime(lastUpdated.toISOString(), tz)}` : ''}</span>
    </div>
  );
}
