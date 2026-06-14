# Dashboard Control Panel

A tiny LAN remote for the Raspberry Pi: open it on your phone to **switch which
dashboard is on the TV**, **reboot**, or **shut down** the Pi. It drives the
existing manifest-driven kiosk (`pi/kiosk-launch.sh` + `pi/switch.sh`) — both
dashboard servers always run, so switching is a ~3s `cog` reload, no reboot.

Express API + a no-build static UI. Unlike the dashboards (loopback-only), this
binds `0.0.0.0` on purpose so your phone can reach it.

## Run it

```bash
cd apps/control
npm install
npm run dev            # http://<this-host>:8080
```

On the Pi it's installed as a user service by `pi/install-control.sh` (which also
adds the `reboot`/`poweroff` sudoers rule). Open `http://<pi-host>:8080` (e.g.
`http://worldcup.local:8080`) from any device on your wifi.

## API

| Method | Route | Does |
|---|---|---|
| GET | `/healthz` | liveness |
| GET | `/api/status` | active app, per-app server up/down, hostname, uptime |
| POST | `/api/switch` `{app}` | swap the TV to `worldcup` \| `family` |
| POST | `/api/reboot` | reboot the Pi |
| POST | `/api/shutdown` | power off the Pi |

## How switching works

`switch` writes a gitignored `.kiosk-active` file at the repo root and restarts
`dashboard-kiosk.service`. `kiosk-launch.sh` reads that override **first** (then
the committed `kiosk.json`), so a phone swap survives `git pull --ff-only`
auto-updates — and the laptop `pi/switch.sh` keeps working as the persistent
default. App ids are validated against a fixed registry before any command runs.

## Security

Open by default — **anyone on your LAN can switch, reboot, or shut down the Pi.**
That's the chosen trade-off for a home network. To lock it down, set
`CONTROL_PIN` in `.env`: the mutating actions then require it (the UI has a PIN
field, saved in the browser); reading status stays open. The PIN is the only
gate, so treat it as a low-security convenience, not real auth.

Privileged actions run as fixed `sudo systemctl …` argv (no shell), gated by
narrow `sudoers.d` allowlists — never blanket sudo.
