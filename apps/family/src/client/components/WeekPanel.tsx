import type { CalSource, DayGroup } from '../../shared/types.js';
import { EventRow } from './EventRow.js';

interface Props {
  weekDays: DayGroup[];
  sources: CalSource[];
  todayKey: string;
  now: Date;
}

export function WeekPanel({ weekDays, sources, todayKey, now }: Props) {
  const future = weekDays.filter((d) => d.key !== todayKey);
  return (
    <div className="panel panel--week">
      <h2 className="panel__title">THE WEEK AHEAD</h2>
      {future.length === 0
        ? <p className="panel__empty">No upcoming events this week.</p>
        : future.map((d) => (
          <div key={d.key} className="daygroup">
            <div className="daygroup__head">{d.label}</div>
            {d.events.map((e) => <EventRow key={e.id} event={e} sources={sources} now={now} />)}
          </div>
        ))}
    </div>
  );
}
