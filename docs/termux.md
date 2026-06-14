# Running a dashboard on your Android phone (Termux)

The model: **edit the repo with the Claude Code app and push → pull on the phone → run it.**
The phone is run-only — no dev tooling, no Pi. You open the board in the phone's browser.

This works because **running the server is pure Node + Express** (`npm start` just executes the
prebuilt `dist/`); the build tools (vite/tsx/esbuild) are only needed when you build. Android-only —
iOS has no real Node runtime.

> Not for `apps/control`: reboot/shutdown/switch are Raspberry-Pi-specific (systemd) and don't apply
> on a phone. This is for the **dashboards** (World Cup, family).

---

## One-time setup

1. **Install Termux from [F-Droid](https://f-droid.org), _not_ the Play Store.** The Play Store build
   is abandoned and breaks. (Install the F-Droid app, then install Termux from inside it.)

2. Install the tools and clone:
   ```bash
   pkg update -y && pkg install -y nodejs git
   git clone <your-repo-url> ~/raspberry-playground
   cd ~/raspberry-playground
   ```

   > **Don't install the `esbuild` package**, and don't set `ESBUILD_BINARY_PATH`. The build (vite)
   > pins a specific esbuild version and refuses to run a different one — pointing it at Termux's
   > esbuild fails with `Expected "0.21.5" but got "0.28.0"`. Just let npm fetch esbuild's own binary;
   > current Termux Node reports `android`, so it self-selects a working build. If you set either of
   > those earlier, undo them: `pkg uninstall esbuild` and remove any `ESBUILD_BINARY_PATH` line from
   > `~/.bashrc` (then `rm -rf node_modules && npm install`).
   >
   > **If the build instead fails with an "exec format / cannot execute" error** (older Termux whose
   > Node reports `linux` and grabbed a glibc binary), use the **proot Debian** path below — it just works.

## Run it

```bash
bash scripts/termux-run.sh            # World Cup  -> http://localhost:3000
bash scripts/termux-run.sh family     # Family     -> http://localhost:3001
```

It pulls latest, writes a sensible default `.env` if none exists, builds, and serves. Open the printed
`http://localhost:PORT` in Chrome/Firefox on the same phone. The first build is the slow part (a minute
or few); after that it's quick. **Ctrl-C** stops it.

## Updating later

You pushed a change from the Claude Code app — on the phone just re-run the same command. It does a
`git pull` first, so it rebuilds and serves the new version. (Run it inside `tmux` if you want it to
survive closing the Termux window: `pkg install tmux`, then `tmux`, then the run command.)

## Live / private data

The default `.env` runs out of the box (World Cup = `openfootball` fixtures, no key; family = bundled
sample). To go live, edit the app's `.env`:

- **World Cup live scores:** `~/raspberry-playground/.env` →
  `DATA_PROVIDER=football_data` + `FOOTBALL_DATA_API_KEY=<free key>`.
- **Your real calendars:** `~/raspberry-playground/apps/family/.env` →
  `CAL_PROVIDER=ical` + `ICAL_SOURCES=...` (see `apps/family/.env.example`). It's your phone, so the
  secret iCal URLs stay on-device — same as the Pi.

## Gotchas

- **Keep-awake:** Android suspends background apps. The script calls `termux-wake-lock` (install
  **Termux:API** from F-Droid for it). Also exclude Termux from battery optimization. Expect heat/
  battery use if you leave it running as an always-on board.
- **localhost only:** the server binds `127.0.0.1` — perfect for viewing on the phone itself. To reach
  it from a laptop/another phone on your wifi, run with `HOST=0.0.0.0`:
  `HOST=0.0.0.0 bash scripts/termux-run.sh`.
- **RAM:** the build is the memory spike; serving is light. Comfortable on a modern phone, tight on a
  low-end one.

## Most-reliable alternative: proot Debian inside Termux

If the esbuild quirk annoys you, run a real Debian userland inside Termux, where everything behaves
like a normal Linux box (no esbuild hack needed):

```bash
pkg install -y proot-distro
proot-distro install debian
proot-distro login debian
# now inside Debian:
apt update && apt install -y nodejs npm git
git clone <your-repo-url> ~/raspberry-playground && cd ~/raspberry-playground
bash scripts/termux-run.sh
```

Heavier to set up, but the most predictable.
