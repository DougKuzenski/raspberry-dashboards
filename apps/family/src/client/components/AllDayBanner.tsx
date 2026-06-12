import type { CalEvent, CalSource } from '../../shared/types.js';
import { civilLabel } from '../../shared/time.js';
import { colorOf } from './colorOf.js';

export function AllDayBanner({ events, sources }: { events: CalEvent[]; sources: CalSource[] }) {
  if (events.length === 0) return <div className="allday allday--empty" />;
  return (
    <div className="allday">
      {events.map((e) => (
        <span key={e.id} className="chip" style={{ borderLeftColor: colorOf(sources, e.source) }}>
          <span className="chip__day">{chipDay(e)}</span>
          {e.title}
        </span>
      ))}
    </div>
  );
}

// "Sat" for a single day, "Thu–Sat" for a multi-day span (endDate is exclusive).
function chipDay(e: CalEvent): string {
  const startDow = civilLabel(e.date!).split(',')[0];
  if (!e.endDate) return startDow;
  const lastDay = shiftDate(e.endDate, -1);
  if (lastDay === e.date) return startDow;
  return `${startDow}–${civilLabel(lastDay).split(',')[0]}`;
}

function shiftDate(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
