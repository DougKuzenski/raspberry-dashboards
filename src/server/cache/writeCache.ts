import { mkdir, writeFile } from 'node:fs/promises';
import type { DashboardData } from '../../shared/types.js';
import { CACHE_DIR, CACHE_FILE } from '../paths.js';

// Persist the last good payload so the dashboard can survive a failed refresh.
export async function writeCache(data: DashboardData): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
}
