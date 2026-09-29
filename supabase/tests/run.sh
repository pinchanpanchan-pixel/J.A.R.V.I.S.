#!/usr/bin/env bash
# Valida las migraciones y la RLS contra un Postgres 16 local temporal.
# Uso: bash supabase/tests/run.sh   (requiere initdb/pg_ctl y pgvector)
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
TMP="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
RUN=""; [ "$(id -u)" = "0" ] && { chown -R postgres "$TMP"; RUN="runuser -u postgres --"; }
$RUN "$PGBIN/initdb" -D "$TMP/data" -A trust -U postgres >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 55432 -c listen_addresses='' -c wal_level=logical" -l "$TMP/log" start >/dev/null
PSQL="env PGOPTIONS=--client_min_messages=warning psql -h $TMP -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f "$DIR/supabase/tests/supabase_shim.sql"
for f in "$DIR"/supabase/migrations/*.sql; do echo "-> $(basename "$f")"; $PSQL -f "$f"; done
$PSQL -f "$DIR/supabase/tests/rls_test.sql"
