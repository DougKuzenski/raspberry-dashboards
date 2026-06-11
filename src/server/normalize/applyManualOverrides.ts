import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DashboardData, Match } from '../../shared/types.js';
import { MANUAL_DIR } from '../paths.js';

// Fields a human is allowed to correct on top of remote data (spec §12). Remote
// scores/status still win; these are the "the API got the channel/time/name
// wrong" escape hatch that keeps the family dashboard trustworthy.
export interface MatchOverride {
  id: string;
  tv?: string;
  stream?: string;
  notes?: string;
  kickoffUtc?: string;
  homeTeamName?: string;
  awayTeamName?: string;
}

interface OverridesFile {
  manualMessage?: string;
  matches?: MatchOverride[];
}

async function readOverrides(): Promise<OverridesFile | null> {
  try {
    const text = await readFile(path.join(MANUAL_DIR, 'overrides.json'), 'utf8');
    return JSON.parse(text) as OverridesFile;
  } catch {
    // No overrides file is a normal, supported state.
    return null;
  }
}

export function applyToMatch(match: Match, o: MatchOverride): Match {
  return {
    ...match,
    tv: o.tv ?? match.tv,
    stream: o.stream ?? match.stream,
    notes: o.notes ?? match.notes,
    kickoffUtc: o.kickoffUtc ?? match.kickoffUtc,
    homeTeam: o.homeTeamName ? { ...match.homeTeam, name: o.homeTeamName } : match.homeTeam,
    awayTeam: o.awayTeamName ? { ...match.awayTeam, name: o.awayTeamName } : match.awayTeam,
  };
}

/** Merge human corrections from data/manual/overrides.json onto remote data. */
export async function applyManualOverrides(data: DashboardData): Promise<DashboardData> {
  const overrides = await readOverrides();
  if (!overrides) return data;

  const byId = new Map((overrides.matches ?? []).map((o) => [o.id, o]));
  const matches = data.matches.map((m) => {
    const o = byId.get(m.id);
    return o ? applyToMatch(m, o) : m;
  });

  return {
    ...data,
    matches,
    manualMessage: overrides.manualMessage ?? data.manualMessage,
  };
}
