import { execFile } from 'node:child_process';
import { readFile, writeFile, rename } from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import { APPS, appById, isKnownApp, resolveActive, type AppEntry } from './apps.js';
import { OVERRIDE_FILE, MANIFEST_FILE } from './paths.js';

const run = promisify(execFile);

// Every privileged action is a fixed argv to a known binary — never a shell
// string — and any app id is validated against the registry first, so there is
// no injection surface even though the routes are unauthenticated by default.
const KIOSK_SERVICE = 'dashboard-kiosk.service';

async function tryRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/** The currently selected dashboard (override file, else committed manifest). */
export async function readActive(): Promise<string> {
  const [override, manifest] = await Promise.all([tryRead(OVERRIDE_FILE), tryRead(MANIFEST_FILE)]);
  return resolveActive(override, manifest);
}

/** Is a dashboard server answering on its port? */
async function serverUp(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(`http://localhost:${port}/healthz`, { signal: ctrl.signal });
      return res.ok;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return false;
  }
}

export interface StatusApp extends AppEntry {
  active: boolean;
  up: boolean;
}

export interface Status {
  hostname: string;
  uptimeSec: number;
  active: string;
  apps: StatusApp[];
}

export async function getStatus(): Promise<Status> {
  const active = await readActive();
  const apps = await Promise.all(
    APPS.map(async (a) => ({ ...a, active: a.id === active, up: await serverUp(a.port) })),
  );
  return { hostname: os.hostname(), uptimeSec: Math.round(os.uptime()), active, apps };
}

/**
 * Switch the displayed dashboard: write the runtime override atomically, then
 * reload the kiosk (cog re-reads the override → ~3s swap). Both servers already
 * run, so there is no rebuild or reboot. Returns the now-active app.
 */
export async function switchApp(id: string): Promise<string> {
  if (!isKnownApp(id)) throw new Error(`unknown app '${id}'`);
  const tmp = `${OVERRIDE_FILE}.tmp`;
  await writeFile(tmp, `${id}\n`, 'utf8');
  await rename(tmp, OVERRIDE_FILE); // atomic replace
  // Allowed passwordless by /etc/sudoers.d/dashboard-kiosk (installed by the kiosk installer).
  await run('sudo', ['-n', 'systemctl', 'restart', KIOSK_SERVICE]);
  return id;
}

/** Reboot / power off the Pi. Allowed passwordless by /etc/sudoers.d/dashboard-control. */
export function reboot(): Promise<unknown> {
  return run('sudo', ['-n', 'systemctl', 'reboot']);
}
export function shutdown(): Promise<unknown> {
  return run('sudo', ['-n', 'systemctl', 'poweroff']);
}

export { appById };
