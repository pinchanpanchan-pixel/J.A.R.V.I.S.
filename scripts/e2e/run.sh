#!/usr/bin/env bash
# Compila, arranca la app en :3100 y ejecuta un test E2E. Uso: bash scripts/e2e/run.sh phase1
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_TELEMETRY_DISABLED=1
[ "${SKIP_BUILD:-0}" = "1" ] || npx next build >/tmp/jarvis-build.log 2>&1 || { tail -40 /tmp/jarvis-build.log; exit 1; }
npx next start -p 3100 >/tmp/jarvis-e2e-server.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf -o /dev/null http://localhost:3100/login && break; sleep 0.5; done
for t in "$@"; do BASE_URL=http://localhost:3100 node "scripts/e2e/$t.mjs"; done
