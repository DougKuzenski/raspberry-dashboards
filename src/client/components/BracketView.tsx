import type { BracketNode, Stage } from '../../shared/types.js';

interface Props {
  nodes: BracketNode[];
}

const STAGE_ORDER: Stage[] = [
  'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final',
];

const STAGE_TITLE: Record<Stage, string> = {
  group: 'Group',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarterfinal: 'Quarterfinals',
  semifinal: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
};

// Renders the knockout bracket as columns by round. Shows placeholder source
// labels ("Winner Group A") before teams are known (spec §6 / Phase 7).
export function BracketView({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">BRACKET</h2>
        <p className="panel__empty">Bracket appears once the knockout rounds begin.</p>
      </div>
    );
  }

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    nodes: nodes.filter((n) => n.stage === stage),
  })).filter((col) => col.nodes.length > 0);

  return (
    <div className="panel">
      <h2 className="panel__title">BRACKET</h2>
      <div className="bracket">
        {byStage.map(({ stage, nodes: col }) => (
          <div key={stage} className="bracket__col">
            <div className="bracket__round">{STAGE_TITLE[stage]}</div>
            {col.map((node) => (
              <div key={node.id} className="bracket__node">
                <div className="bracket__slot">{node.homeSource}</div>
                <div className="bracket__slot">{node.awaySource}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
