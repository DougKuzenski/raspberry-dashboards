import { mkdir, writeFile } from 'node:fs/promises';
import type { CalendarData } from '../../shared/types.js';
import { CACHE_DIR, CACHE_FILE } from '../paths.js';

// Persist the last good payload so the board survives a failed refresh.
export async function writeCache(data: CalendarData): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
}
