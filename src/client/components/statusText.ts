import type { Match } from '../../shared/types.js';
import { formatTimeOfDay } from '../../shared/time.js';

export interface StatusBadge {
  text: string;
  // CSS modifier suffix, e.g. "live" -> .status--live
  variant: 'scheduled' | 'pre' | 'live' | 'ht' | 'final' | 'off';
}

// Visual-state rules from spec §11.
export function statusBadge(match: Match, timeZone?: string): StatusBadge {
  switch (match.status) {
    case 'live':
      return { text: match.minute ? `${match.minute}'` : 'LIVE', variant: 'live' };
    case 'halftime':
      return { text: 'HT', variant: 'ht' };
    case 'pre_match':
      return { text: 'Starting soon', variant: 'pre' };
    case 'finished':
      return { text: 'Final', variant: 'final' };
    case 'postponed':
      return { text: 'Postponed', variant: 'off' };
    case 'cancelled':
      return { text: 'Cancelled', variant: 'off' };
    case 'scheduled':
    default:
      return { text: formatTimeOfDay(match.kickoffUtc, timeZone), variant: 'scheduled' };
  }
}

export function hasScore(match: Match): boolean {
  return match.homeScore != null && match.awayScore != null;
}

export function scoreText(match: Match): string {
  return hasScore(match) ? `${match.homeScore} – ${match.awayScore}` : 'vs';
}
