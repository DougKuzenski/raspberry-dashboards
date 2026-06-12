import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { getDashboard } from './dashboardService.js';
import { CLIENT_DIST } from './paths.js';

const PORT = Number(process.env.PORT ?? 3000);
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

// Optional force-refresh hook (spec §10). Stateless here — the dashboard refetch
// already pulls fresh data — but kept so a button/automation can ping it.
app.post('/api/refresh', async (_req, res) => {
  try {
    const data = await getDashboard();
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

app.listen(PORT, () => {
  console.log(`World Cup dashboard server listening on http://localhost:${PORT}`);
  console.log(`  provider: ${process.env.DATA_PROVIDER ?? 'manual'}`);
});
