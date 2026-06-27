const GROUP_WINNER_RE = /^Winner Group ([A-Z])$/;
const GROUP_RUNNER_UP_RE = /^Runner-up Group ([A-Z])$/;
const BEST_THIRD_RE = /^Best 3rd #(\d+)$/;
const KNOCKOUT_REF_RE = /^(Winner|Loser) ([A-Z0-9]+-\d+)$/;

/** Convert a canonical bracket source into a compact presentation label. */
export function formatBracketSource(source: string): string {
  let match = source.match(GROUP_WINNER_RE);
  if (match) return `GRP ${match[1]} #1`;

  match = source.match(GROUP_RUNNER_UP_RE);
  if (match) return `GRP ${match[1]} #2`;

  match = source.match(BEST_THIRD_RE);
  if (match) return `3RD #${match[1]}`;

  match = source.match(KNOCKOUT_REF_RE);
  if (match) return `${match[1] === 'Winner' ? 'W' : 'L'} ${match[2]}`;

  return source;
}
