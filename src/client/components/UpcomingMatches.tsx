import type { Match } from '../../shared/types.js';
import { formatUpcomingLabel } from '../../shared/time.js';
import { MatchRow } from './MatchRow.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  matches: Match[];
  now: Date;
  excludeMatchId?: string;
}

// A compact strip of the next few matches, shown between the main grid and footer.
export function UpcomingMatches({ matches, now, excludeMatchId }: Props) {
  const tz = useTimeZone();
  const next = matches.filter((m) => m.id !== excludeMatchId).slice(0, 5);
  if (next.length === 0) return null;

  return (
    <div className="upcoming">
      <span className="upcoming__label">UP NEXT</span>
      <ul className="upcoming__list">
        {next.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            variant="compact"
            timeZone={tz}
            timeLabel={formatUpcomingLabel(m.kickoffUtc, now, tz)}
          />
        ))}
      </ul>
    </div>
  );
}
