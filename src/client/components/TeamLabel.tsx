import type { TeamRef } from '../../shared/types.js';
import { isFavoriteTeam } from '../../shared/constants.js';

interface Props {
  team: TeamRef;
  /** Use the short code (e.g. "USA") instead of the full name. */
  short?: boolean;
}

// Flag + name, with a favorite-team accent for USA/MEX/CAN (spec §7 / §21).
export function TeamLabel({ team, short = false }: Props) {
  const favorite = isFavoriteTeam(team.id);
  return (
    <span className={`team${favorite ? ' team--favorite' : ''}`}>
      {team.flagEmoji && <span className="team__flag">{team.flagEmoji}</span>}
      <span className="team__name">{short ? team.shortName ?? team.id : team.name}</span>
    </span>
  );
}
