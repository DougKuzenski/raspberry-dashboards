#!/usr/bin/env bash
# Launched by dashboard-kiosk.service as cage's single client. Reads the active
# dashboard from kiosk.json (committed in the repo), waits for that app's server,
# then becomes cog showing it. Restarting the kiosk re-reads the manifest, so
# flipping kiosk.json + reloading the kiosk is the whole "swap" — no reinstall.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$REPO/kiosk.json"
NODE_BIN="$(command -v node || echo /usr/bin/node)"

# Parse {"active": "..."} with node (always installed); tolerate a missing/bad file.
active="$("$NODE_BIN" -e 'try{process.stdout.write(String(require(process.argv[1]).active||""))}catch(e){}' "$MANIFEST" 2>/dev/null || true)"

case "$active" in
  family)   port=3001 ;;
  worldcup) port=3000 ;;
  *)
    echo "kiosk-launch: active='$active' not recognized in $MANIFEST — defaulting to worldcup" >&2
    port=3000
    ;;
esac

echo "kiosk-launch: active=$active port=$port"
# Wait for the active app's server (both run; this one may still be starting).
until curl -sf "http://localhost:$port/healthz" >/dev/null 2>&1; do sleep 1; done

exec cog "http://localhost:$port"
