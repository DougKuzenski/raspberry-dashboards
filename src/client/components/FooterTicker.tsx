import type { Match } from '../../shared/types.js';
import { formatUpcomingLabel } from '../../shared/time.js';

interface Props {
  upcoming: Match[];
  recent: Match[];
  message?: string;
  now: Date;
}

function code(m: Match, side: 'home' | 'away'): string {
  const team = side === 'home' ? m.homeTeam : m.awayTeam;
  return team.shortName ?? team.id;
}

// "MEX 1-0 RSA" when a result is known, otherwise "MEX v RSA (FT)" — some sources
// (e.g. OpenFootball) report a match as finished before the score is published.
function recentLabel(m: Match): string {
  const known = m.homeScore != null && m.awayScore != null;
  return known
    ? `${code(m, 'home')} ${m.homeScore}-${m.awayScore} ${code(m, 'away')}`
    : `${code(m, 'home')} v ${code(m, 'away')} (FT)`;
}

// Footer ticker: a manual message if set, otherwise recent results, otherwise
// the upcoming schedule (spec §6).
export function FooterTicker({ upcoming, recent, message, now }: Props) {
  let content: string;
  if (message) {
    content = message;
  } else if (recent.length > 0) {
    content = 'RECENT  ·  ' + recent.map(recentLabel).join('   ·   ');
  } else {
    content =
      'UP NEXT  ·  ' +
      upcoming
        .slice(0, 5)
        .map((m) => `${formatUpcomingLabel(m.kickoffUtc, now)} ${code(m, 'home')} v ${code(m, 'away')}`)
        .join('   ·   ');
  }

  return (
    <footer className="ticker">
      <span className="ticker__text">{content}</span>
    </footer>
  );
}
