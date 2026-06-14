// The dashboards this Pi can show. Keep in sync with the kiosk launcher's
// app->port mapping (pi/kiosk-launch.sh) and the dashboard servers' ports.
export interface AppEntry {
  id: string;
  label: string;
  port: number;
}

export const APPS: AppEntry[] = [
  { id: 'worldcup', label: 'World Cup', port: 3000 },
  { id: 'family', label: 'Family Calendar', port: 3001 },
];

export function isKnownApp(id: unknown): id is string {
  return typeof id === 'string' && APPS.some((a) => a.id === id);
}

export function appById(id: string): AppEntry | undefined {
  return APPS.find((a) => a.id === id);
}

/**
 * Resolve which dashboard is active from the runtime override (preferred) and the
 * committed manifest (fallback). Pure so it's unit-testable without the filesystem.
 * Precedence: a valid override > kiosk.json `active` > the first app.
 */
export function resolveActive(override: string | null, manifestRaw: string | null): string {
  const o = (override ?? '').trim();
  if (isKnownApp(o)) return o;
  if (manifestRaw) {
    try {
      const active = (JSON.parse(manifestRaw) as { active?: unknown }).active;
      if (isKnownApp(active)) return active;
    } catch {
      // fall through to default
    }
  }
  return APPS[0].id;
}
