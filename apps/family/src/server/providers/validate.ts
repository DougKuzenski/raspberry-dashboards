import type { CalEvent, CalSource } from '../../shared/types.js';

// Lightweight validation for the hand-edited manual file. Throws a friendly
// error so a typo in events.json fails loudly (caught by the cache fallback)
// rather than rendering a broken board.
export class DataValidationError extends Error {}

export interface ManualFile {
  timezone?: string;
  manualMessage?: string;
  sources: CalSource[];
  events: CalEvent[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateManualFile(value: unknown): ManualFile {
  if (!isObject(value)) throw new DataValidationError('events.json must be an object.');

  const sources = value.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new DataValidationError('events.json: "sources" must be a non-empty array.');
  }
  const sourceIds = new Set<string>();
  for (const s of sources) {
    if (!isObject(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || typeof s.color !== 'string') {
      throw new DataValidationError('Each source needs string id, label, and color.');
    }
    sourceIds.add(s.id);
  }

  const events = value.events;
  if (!Array.isArray(events)) throw new DataValidationError('events.json: "events" must be an array.');
  events.forEach((e, i) => {
    const where = `events[${i}]`;
    if (!isObject(e)) throw new DataValidationError(`${where} must be an object.`);
    if (typeof e.id !== 'string') throw new DataValidationError(`${where}.id is required.`);
    if (typeof e.title !== 'string') throw new DataValidationError(`${where}.title is required.`);
    if (typeof e.source !== 'string' || !sourceIds.has(e.source)) {
      throw new DataValidationError(`${where}.source must reference a defined source id.`);
    }
    if (e.allDay) {
      if (typeof e.date !== 'string') throw new DataValidationError(`${where} is all-day and needs a "date" (YYYY-MM-DD).`);
    } else if (typeof e.start !== 'string') {
      throw new DataValidationError(`${where} is timed and needs a "start" ISO instant.`);
    }
  });

  return value as unknown as ManualFile;
}
