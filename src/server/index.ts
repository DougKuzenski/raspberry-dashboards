import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { getDashboard } from './dashboardService.js';
import { isRefreshAuthorized } from './refreshAuth.js';
import { CLIENT_DIST } from './paths.js';

const PORT = Number(process.env.PORT ?? 3000);
// Bind to loopback by default: the kiosk talks to localhost, so there's no need
// to expose the server to the LAN. Set HOST=0.0.0.0 to view it from other devices.
const HOST = process.env.HOST ?? '127.0.0.1';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const app = express();

// Tiny API (spec §10).
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/dashboard', async (_req, res) => {
  try {
    const data = await getDashboard();
    res.json(data);
  } catch (err) {
    // getDashboard already handles provider/cache failure; this only fires on a
    // truly unexpected error. Never 500 into a blank TV if we can help it.
    console.error('[api] unexpected error building dashboard:', err);
    res.status(500).json({
      generatedAtUtc: new Date().toISOString(),
      tournamentPhase: 'group',
      matches: [],
      standings: [],
      bracket: [],
      stale: true,
      source: 'error',
      manualMessage: 'Unexpected server error. Check the dashboard server logs.',
    });
  }
});

// Force-refresh hook (spec §10): drops the active provider's in-memory cache so
// the next load re-fetches from the source, then returns the fresh payload. Lets
// a button/automation pull new data without waiting out the provider's TTL.
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

// In production, serve the built client. In dev the Vite server serves the UI
// and proxies /api here, so this block is simply skipped.
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: CLIENT_DIST });
  });
}

app.listen(PORT, HOST, () => {
  console.log(`World Cup dashboard server listening on http://${HOST}:${PORT}`);
  console.log(`  provider: ${process.env.DATA_PROVIDER ?? 'manual'}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !REFRESH_TOKEN) {
    console.warn('  warning: bound to a non-loopback host with no REFRESH_TOKEN set — /api/refresh is open on your LAN');
  }
});
