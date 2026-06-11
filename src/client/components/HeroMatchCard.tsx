import type { Match } from '../../shared/types.js';
import { formatKickoffPacific, formatCountdown } from '../../shared/time.js';
import { TeamLabel } from './TeamLabel.js';
import { statusBadge, hasScore } from './statusText.js';

interface Props {
  match?: Match;
  now: Date;
}

// The big focal card: live match if one exists, otherwise the next upcoming.
export function HeroMatchCard({ match, now }: Props) {
  if (!match) {
    return (
      <div className="hero hero--empty">
        <div className="hero__eyebrow">NO UPCOMING MATCHES</div>
        <div className="hero__teams">Check back soon</div>
      </div>
    );
  }

  const badge = statusBadge(match);
  const live = match.status === 'live' || match.status === 'halftime';
  const countdown = match.status === 'scheduled' ? formatCountdown(match.kickoffUtc, now) : undefined;
  const channel = [match.tv, match.stream].filter(Boolean).join(' / ');

  return (
    <div className={`hero hero--${badge.variant}`}>
      <div className="hero__eyebrow">
        {live ? 'LIVE NOW' : 'NEXT MATCH'}
        <span className={`status status--${badge.variant}`}>{badge.text}</span>
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
        <span>{formatKickoffPacific(match.kickoffUtc)} PT</span>
        {channel && <span>· {channel}</span>}
        {match.venue && <span>· {match.venue}</span>}
      </div>

      {countdown && <div className="hero__countdown">Starts in {countdown}</div>}
      {match.notes && <div className="hero__notes">{match.notes}</div>}
    </div>
  );
}
