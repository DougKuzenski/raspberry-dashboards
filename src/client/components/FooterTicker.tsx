import type { Match } from '../../shared/types.js';
import { formatKickoffPacific } from '../../shared/time.js';

interface Props {
  upcoming: Match[];
  recent: Match[];
  message?: string;
}

// Footer ticker: a manual message if set, otherwise recent results, otherwise
// the upcoming schedule (spec §6).
export function FooterTicker({ upcoming, recent, message }: Props) {
  let content: string;
  if (message) {
    content = message;
  } else if (recent.length > 0) {
    content =
      'RECENT  ·  ' +
      recent
        .map((m) => `${m.homeTeam.shortName ?? m.homeTeam.id} ${m.homeScore}-${m.awayScore} ${m.awayTeam.shortName ?? m.awayTeam.id}`)
        .join('   ·   ');
  } else {
    content =
      'UP NEXT  ·  ' +
      upcoming
        .slice(0, 5)
        .map((m) => `${formatKickoffPacific(m.kickoffUtc)} ${m.homeTeam.shortName ?? m.homeTeam.id} v ${m.awayTeam.shortName ?? m.awayTeam.id}`)
        .join('   ·   ');
  }

  return (
    <footer className="ticker">
      <span className="ticker__text">{content}</span>
    </footer>
  );
}
