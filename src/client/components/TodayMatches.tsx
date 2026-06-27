import type { Match } from '../../shared/types.js';
import { formatUpcomingLabel } from '../../shared/time.js';
import { MatchRow } from './MatchRow.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  matches: Match[];
  now: Date;
}

// The full-height primary panel: today + tomorrow's games. Live rows keep their
// red highlight via MatchRow's status styling. The time label shows just the
// time for today's games and a weekday prefix for tomorrow's, so the day reads
// clearly without a separate header per day.
export function TodayMatches({ matches, now }: Props) {
  const tz = useTimeZone();
  return (
    <div className="panel">
      <h2 className="panel__title">TODAY / TOMORROW</h2>
      {matches.length === 0 ? (
        <p className="panel__empty">No matches today or tomorrow.</p>
      ) : (
        <ul className="match-list">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              timeZone={tz}
              timeLabel={formatUpcomingLabel(m.kickoffUtc, now, tz)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
