import type { BracketSlot, ResolvedBracketNode, Stage } from '../../shared/types.js';
import { isFavoriteTeam } from '../../shared/constants.js';

interface Props {
  nodes: ResolvedBracketNode[];
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

// One slot of a bracket node: the resolved team name (or its placeholder source
// label while undecided), with the score and a winner highlight once played.
function Slot({ slot }: { slot: BracketSlot }) {
  const classes = ['bracket__slot'];
  if (slot.isWinner) classes.push('bracket__slot--winner');
  if (slot.team && isFavoriteTeam(slot.team.id)) classes.push('bracket__slot--favorite');
  if (!slot.team) classes.push('bracket__slot--tbd');

  const label = slot.team
    ? `${slot.team.flagEmoji ? `${slot.team.flagEmoji} ` : ''}${slot.team.shortName ?? slot.team.name}`
    : slot.source;

  return (
    <div className={classes.join(' ')}>
      <span className="bracket__team">{label}</span>
      {slot.score != null && <span className="bracket__score">{slot.score}</span>}
    </div>
  );
}

// Renders the knockout bracket as columns by round. Shows placeholder source
// labels ("Winner Group A") before teams are known, then real teams + scores +
// a winner highlight as standings settle and knockout matches finish (spec §6).
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
              <div
                key={node.id}
                className={`bracket__node${node.decided ? ' bracket__node--decided' : ''}`}
              >
                <Slot slot={node.home} />
                <Slot slot={node.away} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
