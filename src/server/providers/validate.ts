// Hand-rolled, dependency-free shape validation. Goal is not exhaustive schema
// enforcement — just fail loudly with a helpful message instead of crashing
// deep in the UI or rendering garbage. (spec §12: "Bad JSON does not crash silently.")
import type { Match, Standing, BracketNode, TeamRef, MatchStatus, Stage } from '../../shared/types.js';

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

const MATCH_STATUSES: MatchStatus[] = [
  'scheduled', 'pre_match', 'live', 'halftime', 'finished', 'postponed', 'cancelled',
];
const STAGES: Stage[] = [
  'group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final',
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DataValidationError(`Expected ${label} to be a JSON array, got ${typeof value}.`);
  }
  return value;
}

function validateTeam(value: unknown, where: string): TeamRef {
  if (!isObject(value)) throw new DataValidationError(`${where}: team must be an object.`);
  if (typeof value.id !== 'string' || !value.id) {
    throw new DataValidationError(`${where}: team.id is required.`);
  }
  if (typeof value.name !== 'string' || !value.name) {
    throw new DataValidationError(`${where}: team.name is required.`);
  }
  return value as unknown as TeamRef;
}

export function validateMatches(value: unknown): Match[] {
  const arr = requireArray(value, 'matches.json');
  return arr.map((raw, i) => {
    const where = `matches[${i}]`;
    if (!isObject(raw)) throw new DataValidationError(`${where} must be an object.`);
    if (typeof raw.id !== 'string' || !raw.id) {
      throw new DataValidationError(`${where}.id is required.`);
    }
    if (!STAGES.includes(raw.stage as Stage)) {
      throw new DataValidationError(`${where}.stage "${String(raw.stage)}" is not a valid stage.`);
    }
    if (!MATCH_STATUSES.includes(raw.status as MatchStatus)) {
      throw new DataValidationError(`${where}.status "${String(raw.status)}" is not valid.`);
    }
    if (typeof raw.kickoffUtc !== 'string' || Number.isNaN(Date.parse(raw.kickoffUtc))) {
      throw new DataValidationError(`${where}.kickoffUtc must be an ISO date string.`);
    }
    validateTeam(raw.homeTeam, `${where}.homeTeam`);
    validateTeam(raw.awayTeam, `${where}.awayTeam`);
    return raw as unknown as Match;
  });
}

export function validateStandings(value: unknown): Standing[] {
  const arr = requireArray(value, 'standings.json');
  return arr.map((raw, i) => {
    const where = `standings[${i}]`;
    if (!isObject(raw)) throw new DataValidationError(`${where} must be an object.`);
    if (typeof raw.group !== 'string' || !raw.group) {
      throw new DataValidationError(`${where}.group is required.`);
    }
    validateTeam(raw.team, `${where}.team`);
    return raw as unknown as Standing;
  });
}

export function validateBracket(value: unknown): BracketNode[] {
  const arr = requireArray(value, 'bracket.json');
  return arr.map((raw, i) => {
    const where = `bracket[${i}]`;
    if (!isObject(raw)) throw new DataValidationError(`${where} must be an object.`);
    if (typeof raw.id !== 'string' || !raw.id) {
      throw new DataValidationError(`${where}.id is required.`);
    }
    if (!STAGES.includes(raw.stage as Stage)) {
      throw new DataValidationError(`${where}.stage "${String(raw.stage)}" is not valid.`);
    }
    if (typeof raw.label !== 'string') {
      throw new DataValidationError(`${where}.label is required.`);
    }
    return raw as unknown as BracketNode;
  });
}

export interface ManualConfig {
  timezone?: string;
  manualMessage?: string;
  favoriteTeams?: string[];
  defaultProvider?: string;
}

export function validateConfig(value: unknown): ManualConfig {
  if (!isObject(value)) throw new DataValidationError('config.json must be an object.');
  return value as ManualConfig;
}
