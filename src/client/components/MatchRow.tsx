import type { Match } from '../../shared/types.js';
import { TeamLabel } from './TeamLabel.js';
import { hasScore, scoreText, statusBadge } from './statusText.js';
import { matchAccent, matchAccentClassNames, venueIcon } from './matchPresentation.js';

interface MatchRowProps {
  match: Match;
  timeZone: string;
  timeLabel: string;
}

function StatusPill({ match, timeZone }: { match: Match; timeZone: string }) {
  const badge = statusBadge(match, timeZone);
  return <span className={`status status--${badge.variant}`}>{badge.text}</span>;
}

function MatchTeams({ match }: { match: Match }) {
  return (
    <span className="match-row__teams">
      <TeamLabel team={match.homeTeam} short />
      <span className={`match-row__score${hasScore(match) ? ' match-row__score--final' : ''}`}>
        {scoreText(match)}
      </span>
      <TeamLabel team={match.awayTeam} short />
    </span>
  );
}

function VenueLine({ match }: { match: Match }) {
  if (!match.venue) return null;

  const accent = matchAccent(match);
  return (
    <span className={`match-row__venue${accent.home ? ' match-row__venue--home' : ''}`}>
      {venueIcon(match)} {match.venue}
    </span>
  );
}

function rowClassName(match: Match, timeZone: string): string {
  const badge = statusBadge(match, timeZone);
  return [
    'match-row',
    'match-row--today',
    `match-row--${badge.variant}`,
    matchAccentClassNames('match-row', match),
  ]
    .filter(Boolean)
    .join(' ');
}

// A single match row in the Today/Tomorrow list. The `match-row--{status}` class
// drives the left-border accent, including the red highlight for live matches.
export function MatchRow({ match, timeZone, timeLabel }: MatchRowProps) {
  return (
    <li className={rowClassName(match, timeZone)}>
      <span className="match-row__time">{timeLabel}</span>
      <span className="match-row__main">
        <MatchTeams match={match} />
        <VenueLine match={match} />
      </span>
      <StatusPill match={match} timeZone={timeZone} />
    </li>
  );
}
