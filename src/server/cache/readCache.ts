import { readFile } from 'node:fs/promises';
import type { DashboardData } from '../../shared/types.js';
import { CACHE_FILE } from '../paths.js';

// Return the last cached payload, or null if none exists / is unreadable.
export async function readCache(): Promise<DashboardData | null> {
  try {
    const text = await readFile(CACHE_FILE, 'utf8');
    return JSON.parse(text) as DashboardData;
  } catch {
    return null;
  }
}
