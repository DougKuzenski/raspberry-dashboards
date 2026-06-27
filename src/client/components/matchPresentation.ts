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

export type MatchListDensity = 'comfortable' | 'compact';

/**
 * Largest Today/Tomorrow list that still fits as comfortable (two-line, with
 * venue) rows on the fixed 1280×720 stage without scrolling or clipping.
 *
 * Fit arithmetic (all px on the design canvas, see dashboard.css / global.css):
 *   stage 720 − 40 padding = 680 inner; rows = header(≈50) + body(1fr) +
 *   ticker(≈43) + 2×14 gap ⇒ body ≈ 559. Panel eats 18×2 padding + 2×2 border +
 *   title(≈36) ⇒ list height ≈ 483px.
 *   Comfortable row ≈ 59px (8×2 padding + 22.5 teams + 3 gap + 17.5 venue) and
 *   the list gap is 8px ⇒ floor((483 + 8) / (59 + 8)) = 7 rows.
 * Beyond that we switch to the compact tier (see COMFORTABLE_ROW_LIMIT usage).
 */
export const COMFORTABLE_ROW_LIMIT = 7;

/**
 * Choose the row density for a Today/Tomorrow list of `count` matches. At or
 * below the comfortable limit we keep the roomy two-line rows; above it we drop
 * to single-line compact rows (venue hidden, smaller type) so even a busy
 * two-day window — realistically up to ~14 group-stage games — shows every match
 * with no scrolling. The compact tier fits ≥16 rows (see dashboard.css). Pure
 * and deterministic so the fit guarantee is unit-testable.
 */
export function matchListDensity(count: number): MatchListDensity {
  return count > COMFORTABLE_ROW_LIMIT ? 'compact' : 'comfortable';
}

export function venueIcon(match: Match): string {
  return matchAccent(match).home ? '📍' : '🏟';
}
