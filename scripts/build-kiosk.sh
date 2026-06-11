#!/usr/bin/env bash
# Build the dashboard for production on the Pi (or anywhere). Produces dist/client
# (static UI) and dist/server (compiled Express server).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Installing dependencies…"
npm install

echo "Building client + server…"
npm run build

echo "Validating manual data…"
npm run validate:data

echo "Done. Start with: npm run start"
