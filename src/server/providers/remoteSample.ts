import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DashboardData } from '../../shared/types.js';
import { SAMPLE_REMOTE_DIR } from '../paths.js';
import { normalizeMatch, type RemoteMatch } from '../normalize/normalizeMatch.js';
import { calculateStandings } from '../normalize/calculateStandings.js';
import { applyManualOverrides } from '../normalize/applyManualOverrides.js';
import { deriveTournamentPhase } from '../../shared/selectDashboardState.js';

// Shared body for the external provider stubs. Today this reads sample
// remote-shaped JSON from disk; a live adapter would fetch + map an API response
// into RemoteMatch[] and reuse everything below unchanged.
async function loadRemoteMatches(file: string): Promise<RemoteMatch[]> {
  const text = await readFile(path.join(SAMPLE_REMOTE_DIR, file), 'utf8');
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${file} to be an array of remote matches.`);
  }
  return parsed as RemoteMatch[];
}

export async function buildDashboardFromRemote(
  sourceName: string,
  file: string,
): Promise<DashboardData> {
  const remote = await loadRemoteMatches(file);
  const matches = remote.map(normalizeMatch);
  const standings = calculateStandings(matches);

  let data: DashboardData = {
    generatedAtUtc: new Date().toISOString(),
    tournamentPhase: deriveTournamentPhase(matches),
    matches,
    standings,
    bracket: [],
    source: sourceName,
  };

  if (process.env.ENABLE_MANUAL_OVERRIDES === 'true') {
    data = await applyManualOverrides(data);
  }
  return data;
}
