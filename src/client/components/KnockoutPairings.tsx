import type { ResolvedBracketNode } from '../../shared/types.js';
import { SlotLine } from './SlotLine.js';

interface Props {
  /** The round's resolved nodes (e.g. the 16 Round-of-32 matchups). */
  nodes: ResolvedBracketNode[];
  /** Panel heading, e.g. "ROUND OF 32". */
  title: string;
}

// Compact pairings grid (spec §6 transition state): the round's matchups as a
// multi-column grid of two-line chips rather than one tall column, so all 16 R32
// pairings fit beside the group rankings AND stay legible on the TV. Decided slots
// show real teams (flag + short name); undecided slots keep their placeholder label
// ("Winner Group A" / "Best 3rd #1"); played matches show scores + a winner accent.
export function KnockoutPairings({ nodes, title }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">{title}</h2>
        <p className="panel__empty">Pairings appear as the groups settle.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel__title">{title}</h2>
      <div className="pairings-grid">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`pairing${node.decided ? ' pairing--decided' : ''}`}
          >
            <SlotLine slot={node.home} base="pairing" />
            <SlotLine slot={node.away} base="pairing" />
            {node.decidedBy === 'PENALTY_SHOOTOUT' && node.penaltyHome != null && node.penaltyAway != null && (
              <div className="pairing__tag">{node.penaltyHome}–{node.penaltyAway} pens</div>
            )}
            {node.decidedBy === 'EXTRA_TIME' && (
              <div className="pairing__tag">aet</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
