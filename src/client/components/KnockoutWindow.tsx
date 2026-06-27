import type { ResolvedBracketNode, Stage } from '../../shared/types.js';
import { selectKnockoutWindow } from '../../shared/knockoutWindow.js';
import { SlotLine } from './SlotLine.js';

interface Props {
  /** The full resolved knockout bracket; the window is selected from it. */
  bracket: ResolvedBracketNode[];
}

const STAGE_TITLE: Record<Stage, string> = {
  group: 'Group',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarterfinal: 'Quarterfinals',
  semifinal: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
};

// Stage-windowed knockout view (spec §6): renders the at-most-two adjacent rounds
// chosen by `selectKnockoutWindow` — the current round on the LEFT, the next round
// (populating to the RIGHT) once current has started. With group rankings gone the
// two columns get the full context width, so they stay large and legible on the TV.
export function KnockoutWindow({ bracket }: Props) {
  const stages = selectKnockoutWindow(bracket);

  if (stages.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">KNOCKOUT</h2>
        <p className="panel__empty">Bracket appears once the knockout rounds begin.</p>
      </div>
    );
  }

  // Wrap a round's nodes into sub-columns (max ~8 rows) so a busy round (R32's 16,
  // R16's 8) stays legible instead of an unreadable 16-tall stack. flex-grow is set
  // to the sub-column count so the busier round gets proportionally more width.
  const columns = stages.map((stage) => {
    const nodes = bracket.filter((n) => n.stage === stage);
    const subCols = Math.min(2, Math.max(1, Math.ceil(nodes.length / 8)));
    return { stage, nodes, subCols };
  });

  return (
    <div className="panel">
      <h2 className="panel__title">KNOCKOUT</h2>
      <div className="kwindow" data-cols={stages.length}>
        {columns.map(({ stage, nodes, subCols }) => (
          <div key={stage} className="kwindow__col" style={{ flexGrow: subCols }}>
            <div className="kwindow__round">{STAGE_TITLE[stage]}</div>
            <div
              className="kwindow__nodes"
              style={{ gridTemplateColumns: `repeat(${subCols}, minmax(0, 1fr))` }}
            >
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className={`kwindow__node${node.decided ? ' kwindow__node--decided' : ''}`}
                >
                  <SlotLine slot={node.home} base="kwindow" />
                  <SlotLine slot={node.away} base="kwindow" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
