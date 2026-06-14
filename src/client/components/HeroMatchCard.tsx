import type { Match } from '../../shared/types.js';
import { formatKickoffPacific, formatCountdown, timeZoneAbbrev } from '../../shared/time.js';
import { TeamLabel } from './TeamLabel.js';
import { statusBadge, hasScore } from './statusText.js';
import { useTimeZone } from '../hooks.js';
import { isHomeCity } from '../../shared/constants.js';

interface Props {
  match?: Match;
  now: Date;
}

// The big focal card: live match if one exists, otherwise the next upcoming.
export function HeroMatchCard({ match, now }: Props) {
  const tz = useTimeZone();
  if (!match) {
    return (
      <div className="hero hero--empty">
        <div className="hero__eyebrow">NO UPCOMING MATCHES</div>
        <div className="hero__teams">Check back soon</div>
      </div>
    );
  }

  const badge = statusBadge(match, tz);
  const live = match.status === 'live' || match.status === 'halftime';
  const countdown = match.status === 'scheduled' ? formatCountdown(match.kickoffUtc, now) : undefined;
  const channel = [match.tv, match.stream].filter(Boolean).join(' / ');
  // De-dupe: venue and city are often the same (we show city names), so a plain
  // join would read "Seattle, Seattle".
  const venue = [...new Set([match.venue, match.city].filter(Boolean))].join(', ');
  const home = isHomeCity(match.city);

  return (
    <div className={`hero hero--${badge.variant}${home ? ' hero--home' : ''}`}>
      <div className="hero__eyebrow">
        {live ? 'LIVE NOW' : 'NEXT MATCH'}
        <span className={`status status--${badge.variant}`}>{badge.text}</span>
        {home && <span className="status status--home">📍 SEATTLE</span>}
      </div>

      <div className="hero__teams">
        <TeamLabel team={match.homeTeam} />
        {hasScore(match) ? (
          <span className="hero__score">
            {match.homeScore} <span className="hero__score-sep">–</span> {match.awayScore}
          </span>
        ) : (
          <span className="hero__vs">vs</span>
        )}
        <TeamLabel team={match.awayTeam} />
      </div>

      <div className="hero__meta">
        <span>{formatKickoffPacific(match.kickoffUtc, tz)} {timeZoneAbbrev(now, tz)}</span>
        {channel && <span>· {channel}</span>}
        {venue && (
          <span className={`hero__venue${home ? ' hero__venue--home' : ''}`}>
            · {home ? '📍' : '🏟'} {venue}
          </span>
        )}
      </div>

      {countdown && <div className="hero__countdown">Starts in {countdown}</div>}
      {match.notes && <div className="hero__notes">{match.notes}</div>}
    </div>
  );
}
