#!/usr/bin/env bash
# Compila, arranca la app en :3100 y ejecuta un test E2E. Uso: bash scripts/e2e/run.sh phase1
set -euo pipefail
cd "$(dirname "$0")/../.."
export NEXT_TELEMETRY_DISABLED=1
[ "${SKIP_BUILD:-0}" = "1" ] || npx next build >/tmp/jarvis-build.log 2>&1 || { tail -40 /tmp/jarvis-build.log; exit 1; }
PORT="${PORT:-3100}"
if curl -sf -o /dev/null "http://localhost:$PORT/login"; then echo "El puerto $PORT ya está en uso" >&2; exit 1; fi
setsid node node_modules/next/dist/bin/next start -p "$PORT" >/tmp/jarvis-e2e-server.log 2>&1 &
PID=$!
trap 'kill -- -$PID 2>/dev/null || kill $PID 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -sf -o /dev/null "http://localhost:$PORT/login" && break; sleep 0.5; done
for t in "$@"; do BASE_URL="http://localhost:$PORT" node "scripts/e2e/$t.mjs"; done
