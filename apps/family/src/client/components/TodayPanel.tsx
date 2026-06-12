import type { CalEvent, CalSource } from '../../shared/types.js';
import { EventRow } from './EventRow.js';

interface Props {
  events: CalEvent[];
  sources: CalSource[];
  now: Date;
}

export function TodayPanel({ events, sources, now }: Props) {
  return (
    <div className="panel">
      <h2 className="panel__title">TODAY</h2>
      {events.length === 0
        ? <p className="panel__empty">Nothing scheduled today.</p>
        : <div>{events.map((e) => <EventRow key={e.id} event={e} sources={sources} now={now} />)}</div>}
    </div>
  );
}
