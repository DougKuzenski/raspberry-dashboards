import type { TournamentPhase } from '../../shared/types.js';
import { formatHeaderDate, formatHeaderClock } from '../../shared/time.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  phase: TournamentPhase;
  now: Date;
  liveCount: number;
}

const PHASE_LABEL: Record<TournamentPhase, string> = {
  group: 'Group Stage',
  knockout: 'Knockout Stage',
};

export function Header({ phase, now, liveCount }: Props) {
  const tz = useTimeZone();
  return (
    <header className="header">
      <div className="header__title">
        <span className="header__brand">WORLD CUP 2026</span>
        <span className="header__phase">{PHASE_LABEL[phase]}</span>
        {liveCount > 0 && <span className="header__live-pip">● {liveCount} LIVE</span>}
      </div>
      <div className="header__clock">
        <span className="header__date">{formatHeaderDate(now, tz)}</span>
        <span className="header__time">{formatHeaderClock(now, tz)}</span>
      </div>
    </header>
  );
}
