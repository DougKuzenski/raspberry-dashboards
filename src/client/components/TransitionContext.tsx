import type { ResolvedBracketNode, Standing } from '../../shared/types.js';
import { GroupStandings } from './GroupStandings.js';
import { KnockoutPairings } from './KnockoutPairings.js';

interface Props {
  /** All standings (every group), rendered as the compact group grid. */
  standings: Standing[];
  /** The hero match's group, highlighted in the standings. */
  featuredGroup?: string;
  /** The forming bracket — real teams for decided slots, placeholders otherwise. */
  bracket: ResolvedBracketNode[];
}

// Group → knockout transition (spec §6): the groups are wrapping up and the R32
// pairings are settling, but no knockout game has been decided yet. Show BOTH at
// once — group rankings stacked above the 16 R32 matchups — so the TV reads as
// "groups settling into knockout slots". The R32 box is a COMPACT pairings grid
// (not the full forming bracket) so all 16 matchups fit beside the rankings and
// stay legible; once the first R32 result lands the panel switches to KnockoutWindow.
export function TransitionContext({ standings, featuredGroup, bracket }: Props) {
  const r32 = bracket.filter((n) => n.stage === 'round_of_32');
  return (
    <div className="transition">
      <div className="transition__pane">
        <GroupStandings standings={standings} featuredGroup={featuredGroup} />
      </div>
      <div className="transition__pane">
        <KnockoutPairings nodes={r32} title="ROUND OF 32" />
      </div>
    </div>
  );
}
