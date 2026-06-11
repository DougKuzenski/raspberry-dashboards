// Team ids whose matches get a visual accent on the dashboard. These are the
// 2026 host nations (United States, Mexico, Canada).
export const FAVORITE_TEAMS = ['USA', 'MEX', 'CAN'] as const;

// All kickoff times are stored in UTC and rendered in this zone.
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// How "recent" a finished match can be to still show as a recent result.
export const RECENT_RESULT_WINDOW_HOURS = 6;

// A match is treated as "starting soon" within this many minutes of kickoff.
export const PRE_MATCH_WINDOW_MINUTES = 15;

export function isFavoriteTeam(teamId: string | undefined): boolean {
  if (!teamId) return false;
  return (FAVORITE_TEAMS as readonly string[]).includes(teamId);
}
