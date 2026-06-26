import type { Match } from '../../shared/types.js';
import { TeamLabel } from './TeamLabel.js';
import { hasScore, scoreText, statusBadge } from './statusText.js';
import { matchAccent, matchAccentClassNames, uniqueVenueParts, venueIcon } from './matchPresentation.js';

export type MatchRowVariant = 'hero' | 'today' | 'compact';

interface MatchRowProps {
  match: Match;
  variant: MatchRowVariant;
  timeZone: string;
  label?: string;
  timeLabel: string;
  countdown?: string;
}

function StatusPill({ match, timeZone }: { match: Match; timeZone: string }) {
  const badge = statusBadge(match, timeZone);
  return <span className={`status status--${badge.variant}`}>{badge.text}</span>;
}

function MatchTeams({ match, short }: { match: Match; short: boolean }) {
  return (
    <span className="match-row__teams">
      <TeamLabel team={match.homeTeam} short={short} />
      <span className={`match-row__score${hasScore(match) ? ' match-row__score--final' : ''}`}>
        {scoreText(match)}
      </span>
      <TeamLabel team={match.awayTeam} short={short} />
    </span>
  );
}

function VenueLine({ match, compact = false }: { match: Match; compact?: boolean }) {
  const venue = compact ? match.venue : uniqueVenueParts(match);
  if (!venue) return null;

  const accent = matchAccent(match);
  return (
    <span className={`match-row__venue${accent.home ? ' match-row__venue--home' : ''}`}>
      {venueIcon(match)} {venue}
    </span>
  );
}

function rowClassName(match: Match, variant: MatchRowVariant, timeZone: string): string {
  const badge = statusBadge(match, timeZone);
  return [
    'match-row',
    `match-row--${variant}`,
    `match-row--${badge.variant}`,
    matchAccentClassNames('match-row', match),
  ]
    .filter(Boolean)
    .join(' ');
}

export function MatchRow({ match, variant, timeZone, label, timeLabel, countdown }: MatchRowProps) {
  const accent = matchAccent(match);

  if (variant === 'hero') {
    const channel = [match.tv, match.stream].filter(Boolean).join(' / ');
    const badge = statusBadge(match, timeZone);
    const className = [
      'hero',
      `hero--${badge.variant}`,
      matchAccentClassNames('hero', match),
      rowClassName(match, variant, timeZone),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={className}>
        <div className="hero__eyebrow">
          {label ?? 'MATCH'}
          <StatusPill match={match} timeZone={timeZone} />
          {accent.home && <span className="status status--home">📍 SEATTLE</span>}
        </div>

        <MatchTeams match={match} short={false} />

        <div className="hero__meta">
          <span>{timeLabel}</span>
          {channel && <span>· {channel}</span>}
          <VenueLine match={match} />
        </div>

        {countdown && <div className="hero__countdown">Starts in {countdown}</div>}
        {match.notes && <div className="hero__notes">{match.notes}</div>}
      </div>
    );
  }

  if (variant === 'compact') {
    const badge = statusBadge(match, timeZone);
    return (
      <li className={rowClassName(match, variant, timeZone)}>
        <span className="match-row__main">
          <MatchTeams match={match} short />
          <VenueLine match={match} compact />
        </span>
        <span className="match-row__time">{timeLabel}</span>
        {badge.variant !== 'scheduled' && <StatusPill match={match} timeZone={timeZone} />}
      </li>
    );
  }

  return (
    <li className={rowClassName(match, variant, timeZone)}>
      <span className="match-row__time">{timeLabel}</span>
      <span className="match-row__main">
        <MatchTeams match={match} short />
        <VenueLine match={match} compact />
      </span>
      <StatusPill match={match} timeZone={timeZone} />
    </li>
  );
}
