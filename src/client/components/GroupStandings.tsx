import type { Standing } from '../../shared/types.js';
import { isFavoriteTeam } from '../../shared/constants.js';

interface Props {
  /** All standings (every group). The grid renders one mini-table per group. */
  standings: Standing[];
  /** The hero match's group, highlighted so the eye lands on it first. */
  featuredGroup?: string;
}

// Compact "all groups at once" grid for the group stage. Each group is a small
// 4-row card; the featured group is accented and favorite teams (USA/MEX/CAN)
// are tinted. Tuned to fit all 12 WC2026 groups in the side panel.
export function GroupStandings({ standings, featuredGroup }: Props) {
  if (standings.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">GROUPS</h2>
        <p className="panel__empty">No standings yet.</p>
      </div>
    );
  }

  const byGroup = new Map<string, Standing[]>();
  for (const s of standings) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }
  const groups = [...byGroup.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div className="panel">
      <h2 className="panel__title">GROUPS</h2>
      <div className="groups-grid">
        {groups.map((g) => {
          const rows = byGroup.get(g)!.slice().sort((a, b) => a.rank - b.rank);
          const featured = g === featuredGroup;
          return (
            <div key={g} className={`group-card${featured ? ' group-card--featured' : ''}`}>
              <div className="group-card__title">Group {g}</div>
              {rows.map((s) => (
                <div
                  key={s.team.id}
                  className={`group-card__row${isFavoriteTeam(s.team.id) ? ' group-card__row--favorite' : ''}`}
                >
                  <span className="group-card__pos">{s.rank}</span>
                  <span className="group-card__team">
                    {s.team.flagEmoji && <span className="team__flag">{s.team.flagEmoji}</span>}
                    {s.team.shortName ?? s.team.id}
                  </span>
                  <span className="group-card__pts">{s.points}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
