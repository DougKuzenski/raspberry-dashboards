import { formatTime, formatLongDate, timeZoneAbbrev } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  now: Date;
  weekLabel: string;
}

export function Header({ now, weekLabel }: Props) {
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
