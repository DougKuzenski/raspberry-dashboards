import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { getDashboard } from './dashboardService.js';
import { isRefreshAuthorized } from './refreshAuth.js';
import { DEFAULT_TIMEZONE } from '../shared/constants.js';
import { CLIENT_DIST } from './paths.js';

const PORT = Number(process.env.PORT ?? 3001);
// Bind to loopback by default: the kiosk talks to localhost, and a family
// calendar is private. Set HOST=0.0.0.0 to view it from other devices.
const HOST = process.env.HOST ?? '127.0.0.1';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const app = express();

// Surface the two .env traps at boot (they otherwise fail silently or only show
// up per-request in the fallback message). See apps/family/.env.example.
function warnOnConfig(): void {
  const provider = process.env.CAL_PROVIDER ?? 'manual';
  const sources = process.env.ICAL_SOURCES;
  if (provider === 'manual' && sources) {
    console.warn(
      '  warning: ICAL_SOURCES is set but CAL_PROVIDER=manual — serving sample data, not your calendars. Set CAL_PROVIDER=ical.',
    );
  }
  if (provider === 'ical') {
    if (!sources) {
      console.warn('  warning: CAL_PROVIDER=ical but ICAL_SOURCES is not set — the board will be empty.');
    } else {
      try {
        JSON.parse(sources);
      } catch (err) {
        console.warn(
          `  warning: CAL_PROVIDER=ical but ICAL_SOURCES is not valid JSON (${err instanceof Error ? err.message : String(err)}). ` +
            "If your colors contain '#', wrap the whole ICAL_SOURCES value in single quotes in .env.",
        );
      }
    }
  }
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    res.json(await getDashboard());
  } catch (err) {
    console.error('[api] unexpected error building calendar:', err);
    res.status(500).json({
      generatedAtUtc: new Date().toISOString(),
      timezone: process.env.TIMEZONE || DEFAULT_TIMEZONE,
      sources: [],
      events: [],
      stale: true,
      source: 'error',
      manualMessage: 'Unexpected server error. Check the dashboard server logs.',
    });
  }
});

// Force-refresh: drop the provider's in-memory cache, then return fresh data.
app.post('/api/refresh', async (req, res) => {
  if (!isRefreshAuthorized(REFRESH_TOKEN, { header: req.get('X-Refresh-Token'), query: req.query.token })) {
    return res.status(401).json({ ok: false, error: 'invalid or missing refresh token' });
  }
  try {
    const data = await getDashboard({ forceRefresh: true });
    res.json({ ok: true, generatedAtUtc: data.generatedAtUtc });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// In production, serve the built client. In dev, Vite serves the UI and proxies /api.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: CLIENT_DIST });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Family dashboard server listening on http://${HOST}:${PORT}`);
  console.log(`  provider: ${process.env.CAL_PROVIDER ?? 'manual'}`);
  warnOnConfig();
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !REFRESH_TOKEN) {
    console.warn('  warning: bound to a non-loopback host with no REFRESH_TOKEN set — /api/refresh is open on your LAN');
  }
});
