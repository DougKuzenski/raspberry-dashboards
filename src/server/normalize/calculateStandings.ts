import type { Match, Standing, TeamRef } from '../../shared/types.js';

// Derive group standings from finished group-stage matches. Used by external
// providers that deliver only fixtures/results; manual standings (when present)
// take precedence and skip this path entirely.

interface Row {
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyRow(team: TeamRef): Row {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

export function calculateStandings(matches: Match[]): Standing[] {
  // group -> teamId -> row
  const groups = new Map<string, Map<string, Row>>();

  const rowFor = (group: string, team: TeamRef): Row => {
    let byTeam = groups.get(group);
    if (!byTeam) {
      byTeam = new Map();
      groups.set(group, byTeam);
    }
    let row = byTeam.get(team.id);
    if (!row) {
      row = emptyRow(team);
      byTeam.set(team.id, row);
    }
    return row;
  };

  for (const m of matches) {
    if (m.stage !== 'group' || !m.group) continue;
    // Register both teams even before they've played, so a group shows all four.
    const home = rowFor(m.group, m.homeTeam);
    const away = rowFor(m.group, m.awayTeam);

    if (m.status !== 'finished' || m.homeScore == null || m.awayScore == null) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (m.homeScore < m.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const standings: Standing[] = [];
  for (const [group, byTeam] of groups) {
    const rows = [...byTeam.values()];
    rows.sort(compareRows);
    rows.forEach((r, i) => {
      standings.push({
        group,
        team: r.team,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        goalDifference: r.goalsFor - r.goalsAgainst,
        points: r.points,
        rank: i + 1,
      });
    });
  }
  return standings;
}

// FIFA group ordering: points, then goal difference, then goals for, then name.
function compareRows(a: Row, b: Row): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.name.localeCompare(b.team.name);
}
