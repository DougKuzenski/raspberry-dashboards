import path from 'node:path';

// The server is always launched with the app directory as CWD (npm scripts /
// systemd WorkingDirectory), so anchor data + build output here.
export const PROJECT_ROOT = process.cwd();
export const MANUAL_DIR = path.join(PROJECT_ROOT, 'data', 'manual');
export const CACHE_DIR = path.join(PROJECT_ROOT, 'data', 'cache');
export const CACHE_FILE = path.join(CACHE_DIR, 'calendar.json');
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'dist', 'client');
