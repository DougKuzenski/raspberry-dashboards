import type { CalEvent, CalSource } from '../../shared/types.js';
import { formatTime } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';
import { colorOf } from './colorOf.js';

interface Props {
  event: CalEvent;
  sources: CalSource[];
  now: Date;
}

export function EventRow({ event, sources, now }: Props) {
  const tz = useTimeZone();
  const past = !event.allDay && event.end != null && Date.parse(event.end) < now.getTime();
  const cls = [
    'ev',
    event.tentative ? 'ev--tentative' : '',
    event.kind === 'flight' ? 'ev--flight' : '',
    event.highlight ? 'ev--hi' : '',
    past ? 'ev--past' : '',
  ].join(' ');
  const accent =
    event.kind === 'flight' ? '#60a5fa' : event.highlight ? '#fb7185' : colorOf(sources, event.source);
  return (
    <div className={cls}>
      <div className="ev__time">
        {event.allDay
          ? <>All<small>day</small></>
          : <>{formatTime(event.start!, tz)}<small>{event.end ? formatTime(event.end, tz) : ''}</small></>}
      </div>
      <div>
        <div className="ev__name" style={{ borderLeftColor: accent }}>{event.title}</div>
        {event.location && <div className="ev__where">{event.location}</div>}
      </div>
    </div>
  );
}
