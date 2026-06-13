import type { Match } from '../../shared/types.js';
import { formatTimeOfDay } from '../../shared/time.js';
import { TeamLabel } from './TeamLabel.js';
import { statusBadge, scoreText } from './statusText.js';
import { useTimeZone } from '../hooks.js';
import { isHomeCity } from '../../shared/constants.js';

interface Props {
  matches: Match[];
  now: Date;
}

export function TodayMatches({ matches }: Props) {
  const tz = useTimeZone();
  return (
    <div className="panel">
      <h2 className="panel__title">TODAY</h2>
      {matches.length === 0 ? (
        <p className="panel__empty">No matches today.</p>
      ) : (
        <ul className="match-list">
          {matches.map((m) => {
            const badge = statusBadge(m, tz);
            const home = isHomeCity(m.city);
            return (
              <li key={m.id} className={`match-row match-row--${badge.variant}${home ? ' match-row--home' : ''}`}>
                <span className="match-row__time">{formatTimeOfDay(m.kickoffUtc, tz)}</span>
                <span className="match-row__main">
                  <span className="match-row__teams">
                    <TeamLabel team={m.homeTeam} short />
                    <span className="match-row__score">{scoreText(m)}</span>
                    <TeamLabel team={m.awayTeam} short />
                  </span>
                  {m.venue && (
                    <span className={`match-row__venue${home ? ' match-row__venue--home' : ''}`}>
                      {home ? '📍' : '🏟'} {m.venue}
                    </span>
                  )}
                </span>
                <span className={`status status--${badge.variant}`}>{badge.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
