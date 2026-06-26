import type { ResolvedBracketNode, Standing } from '../../shared/types.js';
import { GroupStandings } from './GroupStandings.js';
import { BracketView } from './BracketView.js';

interface Props {
  /** All standings (every group), rendered as the compact group grid. */
  standings: Standing[];
  /** The hero match's group, highlighted in the standings. */
  featuredGroup?: string;
  /** The forming bracket — real teams for decided slots, placeholders otherwise. */
  bracket: ResolvedBracketNode[];
}

// Group → knockout transition (spec §6): while the group stage is wrapping up but
// the bracket is already forming, show BOTH at once — group standings stacked above
// the forming bracket — so the TV reads as "groups settling into knockout slots".
// Reuses GroupStandings and BracketView unchanged; only the stacked layout is new.
export function TransitionContext({ standings, featuredGroup, bracket }: Props) {
  return (
    <div className="transition">
      <div className="transition__pane">
        <GroupStandings standings={standings} featuredGroup={featuredGroup} />
      </div>
      <div className="transition__pane">
        <BracketView nodes={bracket} />
      </div>
    </div>
  );
}
