import type { Standing } from '../../shared/types.js';
import { isFavoriteTeam } from '../../shared/constants.js';

interface Props {
  group?: string;
  standings: Standing[];
}

// Group table for the hero match's group (or all groups when none is featured).
export function GroupStandings({ group, standings }: Props) {
  if (standings.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">STANDINGS</h2>
        <p className="panel__empty">No standings yet.</p>
      </div>
    );
  }

  // Group the rows under their group heading so an "all groups" view is readable.
  const byGroup = new Map<string, Standing[]>();
  for (const s of standings) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }

  return (
    <div className="panel">
      <h2 className="panel__title">{group ? `GROUP ${group}` : 'STANDINGS'}</h2>
      {[...byGroup.entries()].map(([g, rows]) => (
        <div key={g} className="standings">
          {!group && <div className="standings__group">Group {g}</div>}
          <table className="standings__table">
            <thead>
              <tr>
                <th className="standings__pos">#</th>
                <th className="standings__team">Team</th>
                <th>P</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.team.id}
                  className={isFavoriteTeam(s.team.id) ? 'standings__row--favorite' : undefined}
                >
                  <td className="standings__pos">{s.rank}</td>
                  <td className="standings__team">
                    {s.team.flagEmoji && <span className="team__flag">{s.team.flagEmoji}</span>}
                    {s.team.shortName ?? s.team.name}
                  </td>
                  <td>{s.played}</td>
                  <td>{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</td>
                  <td className="standings__pts">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
