import type { Match } from '../../shared/types.js';
import { formatKickoffPacific, formatCountdown, timeZoneAbbrev } from '../../shared/time.js';
import { MatchRow } from './MatchRow.js';
import { useTimeZone } from '../hooks.js';

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

  const live = match.status === 'live' || match.status === 'halftime';
  const countdown = match.status === 'scheduled' ? formatCountdown(match.kickoffUtc, now) : undefined;
  const timeLabel = `${formatKickoffPacific(match.kickoffUtc, tz)} ${timeZoneAbbrev(now, tz)}`;

  return (
    <MatchRow
      match={match}
      variant="hero"
      timeZone={tz}
      label={live ? 'LIVE NOW' : 'NEXT MATCH'}
      timeLabel={timeLabel}
      countdown={countdown}
    />
  );
}
