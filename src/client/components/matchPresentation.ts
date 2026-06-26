import type { Match } from '../../shared/types.js';
import { isFavoriteTeam, isHomeCity } from '../../shared/constants.js';

export interface MatchAccent {
  favorite: boolean;
  home: boolean;
}

export function matchAccent(match: Match): MatchAccent {
  return {
    favorite: isFavoriteTeam(match.homeTeam.id) || isFavoriteTeam(match.awayTeam.id),
    home: isHomeCity(match.city),
  };
}

export function matchAccentClassNames(baseClass: string, match: Match): string {
  const accent = matchAccent(match);
  return [
    accent.favorite ? `${baseClass}--favorite` : undefined,
    accent.home ? `${baseClass}--home` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
}

export function uniqueVenueParts(match: Match): string {
  return [...new Set([match.venue, match.city].filter(Boolean))].join(', ');
}

export function venueIcon(match: Match): string {
  return matchAccent(match).home ? '📍' : '🏟';
}
