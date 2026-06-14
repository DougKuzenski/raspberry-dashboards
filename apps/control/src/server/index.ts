import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { getStatus, switchApp, reboot, shutdown } from './actions.js';
import { isKnownApp } from './apps.js';
import { PUBLIC_DIR } from './paths.js';

const PORT = Number(process.env.PORT ?? 8080);
// Bind to all interfaces ON PURPOSE — unlike the dashboards, this panel is meant
// to be reached from your phone across the LAN.
const HOST = process.env.HOST ?? '0.0.0.0';
// Optional shared PIN. Unset (default) => open, as chosen. When set, every
// mutating action requires it via `x-control-pin` header or `?pin=`.
const PIN = process.env.CONTROL_PIN;

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Status is safe to read unauthenticated even when a PIN is set (it drives the UI).
app.get('/api/status', async (_req, res) => {
  try {
    res.json({ ...(await getStatus()), authRequired: Boolean(PIN) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Gate the mutating routes behind the PIN when one is configured.
function requirePin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!PIN) return next();
  const provided = req.get('x-control-pin') ?? req.query.pin;
  if (provided === PIN) return next();
  res.status(401).json({ ok: false, error: 'invalid or missing PIN' });
}

app.post('/api/switch', requirePin, async (req, res) => {
  const id = String((req.body as { app?: unknown })?.app ?? req.query.app ?? '');
  if (!isKnownApp(id)) {
    res.status(400).json({ ok: false, error: `unknown app '${id}'` });
    return;
  }
  try {
    res.json({ ok: true, active: await switchApp(id) });
  } catch (err) {
    console.error('[control] switch failed:', err);
    res.status(500).json({ ok: false, error: 'switch failed — is the kiosk sudoers rule installed?' });
  }
});

// Power actions: respond first, then fire the command so the HTTP reply flushes
// before the Pi goes down.
function powerRoute(action: () => Promise<unknown>, label: string) {
  return (_req: express.Request, res: express.Response) => {
    res.json({ ok: true, action: label });
    setTimeout(() => {
      action().catch((err) => console.error(`[control] ${label} failed:`, err));
    }, 750);
  };
}
app.post('/api/reboot', requirePin, powerRoute(reboot, 'reboot'));
app.post('/api/shutdown', requirePin, powerRoute(shutdown, 'shutdown'));

if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

app.listen(PORT, HOST, () => {
  console.log(`Dashboard control panel on http://${HOST}:${PORT}`);
  console.log(`  auth: ${PIN ? 'PIN required' : 'open (no PIN set)'}`);
});
