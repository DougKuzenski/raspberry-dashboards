import type { BracketSlot } from '../../shared/types.js';
import { isFavoriteTeam } from '../../shared/constants.js';
import { formatBracketSource } from './bracketLabel.js';

interface Props {
  slot: BracketSlot;
  /** BEM block prefix for the emitted classes (e.g. "kwindow" or "pairing"). */
  base: string;
}

// One slot of a bracket node: the resolved team (flag + short name) or, while the
// source is still undecided, its compact placeholder label ("GRP A #1"), with the
// score and a winner highlight once the match is played. Shared by the windowed
// knockout view and the transition R32 pairings grid, parameterized by `base` so
// each surface keeps its own scoped CSS.
export function SlotLine({ slot, base }: Props) {
  const classes = [`${base}__slot`];
  if (slot.isWinner) classes.push(`${base}__slot--winner`);
  if (slot.team && isFavoriteTeam(slot.team.id)) classes.push(`${base}__slot--favorite`);
  if (!slot.team) classes.push(`${base}__slot--tbd`);

  const label = slot.team
    ? `${slot.team.flagEmoji ? `${slot.team.flagEmoji} ` : ''}${slot.team.shortName ?? slot.team.name}`
    : formatBracketSource(slot.source);

  return (
    <div className={classes.join(' ')}>
      <span className={`${base}__team`}>{label}</span>
      {slot.score != null && <span className={`${base}__score`}>{slot.score}</span>}
    </div>
  );
}
