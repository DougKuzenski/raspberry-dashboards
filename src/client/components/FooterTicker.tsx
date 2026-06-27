import type { Match } from '../../shared/types.js';

interface Props {
  recent: Match[];
  message?: string;
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

// Footer ticker: a manual message if set, otherwise recent results. When there's
// nothing to say the ticker collapses (returns null) and gives the body room.
export function FooterTicker({ recent, message }: Props) {
  let content: string;
  if (message) {
    content = message;
  } else if (recent.length > 0) {
    content = 'RECENT  ·  ' + recent.map(recentLabel).join('   ·   ');
  } else {
    return null;
  }

  return (
    <footer className="ticker">
      <span className="ticker__text">{content}</span>
    </footer>
  );
}
