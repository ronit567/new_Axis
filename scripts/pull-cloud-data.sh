#!/usr/bin/env bash
#
# pull-cloud-data.sh — copy data from the cloud Supabase project into the
# running local stack (auth users + public app data + storage bucket defs).
#
# Usage:
#   CLOUD_DB_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres" \
#     ./scripts/pull-cloud-data.sh
#
#   # or, if you have the whole URL in an env file:
#   export CLOUD_DB_URL=...
#   ./scripts/pull-cloud-data.sh
#
# Where to get CLOUD_DB_URL:
#   Supabase Dashboard -> Project Settings -> Database -> Connection string.
#   Use the SESSION POOLER URI (host aws-1-<region>.pooler.supabase.com, port 5432,
#   user postgres.<ref>). The direct db.<ref>.supabase.co host is IPv6-only and
#   often unreachable. URL-encode special chars in the password (e.g. ! -> %21,
#   ? -> %3F).
#
# What it does:
#   1. Dumps data-only from cloud (auth + public + storage schemas).
#   2. Strips the storage.buckets INSERT — migration 0014 already creates the
#      exact same buckets locally, so re-inserting them would be a duplicate-key
#      error.
#   3. Runs `supabase db reset` to rebuild a clean local DB (all migrations).
#   4. Loads the data into the local Postgres container.
#
# The dump sets `session_replication_role = replica`, so FK checks and triggers
# (e.g. the notification triggers) are disabled during load — ordering is safe
# and no spurious notifications are generated from historical messages.
#
# WARNING: step 3 WIPES all local data. The dump file contains real auth
# password hashes and tokens — it is written to a gitignored path and deleted
# at the end. Never commit it.

set -euo pipefail

CONTAINER="${LOCAL_DB_CONTAINER:-supabase_db_new_Axis}"
DUMP_FILE="cloud_data.sql"        # gitignored (cloud_*.sql)
LOAD_FILE="cloud_data_load.sql"   # gitignored (cloud_*.sql)

cleanup() { rm -f "$DUMP_FILE" "$LOAD_FILE"; }
trap cleanup EXIT

if [[ -z "${CLOUD_DB_URL:-}" ]]; then
  echo "ERROR: set CLOUD_DB_URL (session pooler URI). See header of this script." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: local DB container '$CONTAINER' is not running. Run 'npx supabase start' first." >&2
  echo "       (If your container has a different name, set LOCAL_DB_CONTAINER.)" >&2
  exit 1
fi

echo "==> Dumping data-only from cloud (auth + public + storage)..."
npx supabase db dump --db-url "$CLOUD_DB_URL" --data-only -f "$DUMP_FILE"

echo "==> Stripping redundant storage.buckets INSERT (migration 0014 owns those buckets)..."
# Remove the single multi-row INSERT INTO "storage"."buckets" (... VALUES) statement,
# from its INSERT line through the line ending in ';'. Leaves everything else intact.
awk '
  /^INSERT INTO "storage"\."buckets"/ { skip = 1 }
  skip && /;[[:space:]]*$/            { skip = 0; next }
  skip                               { next }
  { print }
' "$DUMP_FILE" > "$LOAD_FILE"

echo "==> Resetting local DB (applies all migrations)..."
npx supabase db reset

echo "==> Loading cloud data into local container '$CONTAINER'..."
docker exec -i "$CONTAINER" \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$LOAD_FILE"

echo "==> Done. Local DB now holds the cloud data. Dump files cleaned up."
echo "    Log in as any cloud user with their real password; new OTP emails"
echo "    appear at http://localhost:54324 (Inbucket)."
