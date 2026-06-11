import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { DashboardData, TournamentPhase } from '../../shared/types.js';
import type { DataProvider } from './providerTypes.js';
import { MANUAL_DIR } from '../paths.js';
import {
  DataValidationError,
  validateMatches,
  validateStandings,
  validateBracket,
  validateConfig,
} from './validate.js';

async function readJson(file: string): Promise<unknown> {
  const full = path.join(MANUAL_DIR, file);
  let text: string;
  try {
    text = await readFile(full, 'utf8');
  } catch {
    throw new DataValidationError(`Could not read manual data file: ${full}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new DataValidationError(`${file} is not valid JSON: ${detail}`);
  }
}

// Phase is derived from the data: knockout once any non-group match exists.
function derivePhase(matches: ReturnType<typeof validateMatches>): TournamentPhase {
  return matches.some((m) => m.stage !== 'group') ? 'knockout' : 'group';
}

// Reads the four manual JSON files, validates them, and assembles DashboardData.
export const manualProvider: DataProvider = {
  name: 'manual',
  async fetchDashboardData(): Promise<DashboardData> {
    const [matchesRaw, standingsRaw, bracketRaw, configRaw] = await Promise.all([
      readJson('matches.json'),
      readJson('standings.json'),
      readJson('bracket.json'),
      readJson('config.json'),
    ]);

    const matches = validateMatches(matchesRaw);
    const standings = validateStandings(standingsRaw);
    const bracket = validateBracket(bracketRaw);
    const config = validateConfig(configRaw);

    return {
      generatedAtUtc: new Date().toISOString(),
      tournamentPhase: derivePhase(matches),
      matches,
      standings,
      bracket,
      manualMessage: config.manualMessage,
      source: 'manual',
    };
  },
};
