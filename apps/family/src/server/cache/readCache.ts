import { readFile } from 'node:fs/promises';
import type { CalendarData } from '../../shared/types.js';
import { CACHE_FILE } from '../paths.js';

// Return the last cached payload, or null if none exists / is unreadable.
export async function readCache(): Promise<CalendarData | null> {
  try {
    return JSON.parse(await readFile(CACHE_FILE, 'utf8')) as CalendarData;
  } catch {
    return null;
  }
}
