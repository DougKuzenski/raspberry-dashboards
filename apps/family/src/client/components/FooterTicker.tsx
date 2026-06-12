import type { CalendarView } from '../../shared/types.js';
import { formatTime, civilLabel, zonedDayLabel } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';

// Footer message: a manual message if set, otherwise the next highlighted
// milestone, otherwise a friendly default.
export function FooterTicker({ view }: { view: CalendarView }) {
  const tz = useTimeZone();
  const hi = view.weekDays.flatMap((d) => d.events).find((e) => e.highlight);
  const msg =
    view.data.manualMessage ??
    (hi
      ? `⭐ ${hi.title} — ${hi.allDay ? civilLabel(hi.date!) : `${zonedDayLabel(hi.start!, tz)} ${formatTime(hi.start!, tz)}`}`
      : 'Have a good week!');
  return (
    <footer className="ticker"><span>{msg}</span></footer>
  );
}
