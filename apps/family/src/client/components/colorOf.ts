import type { CalSource } from '../../shared/types.js';

export function colorOf(sources: CalSource[], id: string): string {
  return sources.find((s) => s.id === id)?.color ?? '#64748b';
}
