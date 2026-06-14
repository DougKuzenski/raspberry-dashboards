import path from 'node:path';

// The control server is launched with apps/control as CWD (npm scripts / systemd
// WorkingDirectory), so the repo root is two levels up. REPO_ROOT overridable for
// odd clone layouts.
export const APP_DIR = process.cwd();
export const PUBLIC_DIR = path.join(APP_DIR, 'public');
export const REPO_ROOT = process.env.REPO_ROOT || path.resolve(APP_DIR, '..', '..');

// The runtime kiosk choice. A gitignored override file the kiosk launcher reads
// FIRST (so a phone swap survives `git pull --ff-only` auto-updates, unlike
// editing the tracked manifest); kiosk.json is the committed default/fallback.
export const OVERRIDE_FILE = path.join(REPO_ROOT, '.kiosk-active');
export const MANIFEST_FILE = path.join(REPO_ROOT, 'kiosk.json');
