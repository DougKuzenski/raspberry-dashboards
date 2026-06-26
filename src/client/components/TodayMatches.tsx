import type { Match } from '../../shared/types.js';
import { formatTimeOfDay } from '../../shared/time.js';
import { MatchRow } from './MatchRow.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  matches: Match[];
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
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              variant="today"
              timeZone={tz}
              timeLabel={formatTimeOfDay(m.kickoffUtc, tz)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
