import type { Match } from '../../shared/types.js';
import { formatUpcomingLabel } from '../../shared/time.js';
import { isFavoriteTeam } from '../../shared/constants.js';
import { useTimeZone } from '../hooks.js';

interface Props {
  matches: Match[];
  now: Date;
}

// A compact strip of the next few matches, shown between the main grid and footer.
export function UpcomingMatches({ matches, now }: Props) {
  const tz = useTimeZone();
  const next = matches.slice(0, 5);
  if (next.length === 0) return null;

  return (
    <div className="upcoming">
      <span className="upcoming__label">UP NEXT</span>
      <ul className="upcoming__list">
        {next.map((m) => {
          const fav = isFavoriteTeam(m.homeTeam.id) || isFavoriteTeam(m.awayTeam.id);
          return (
            <li key={m.id} className={`upcoming__item${fav ? ' upcoming__item--favorite' : ''}`}>
              <span className="upcoming__teams">
                {m.homeTeam.shortName ?? m.homeTeam.id} v {m.awayTeam.shortName ?? m.awayTeam.id}
              </span>
              <span className="upcoming__time">{formatUpcomingLabel(m.kickoffUtc, now, tz)}</span>
              {m.venue && <span className="upcoming__venue">🏟 {m.venue}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
