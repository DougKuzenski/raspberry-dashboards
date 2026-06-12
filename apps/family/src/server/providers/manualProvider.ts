import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CalendarData } from '../../shared/types.js';
import type { CalendarProvider } from './providerTypes.js';
import { MANUAL_DIR } from '../paths.js';
import { DEFAULT_TIMEZONE } from '../../shared/constants.js';
import { DataValidationError, validateManualFile } from './validate.js';

// Default provider: hand-edited data/manual/events.json. No network — the board
// works out of the box, and you can correct anything by editing the file.
export const manualProvider: CalendarProvider = {
  name: 'manual',
  async fetchCalendarData(): Promise<CalendarData> {
    const file = path.join(MANUAL_DIR, 'events.json');
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new DataValidationError(`Could not read/parse ${file}: ${detail}`);
    }
    const data = validateManualFile(raw);
    return {
      generatedAtUtc: new Date().toISOString(),
      timezone: data.timezone ?? DEFAULT_TIMEZONE,
      sources: data.sources,
      events: data.events,
      manualMessage: data.manualMessage,
      source: 'manual',
    };
  },
};
