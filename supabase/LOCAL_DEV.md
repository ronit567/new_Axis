# Running Axis against a local Supabase stack

This runs the entire Supabase backend (Postgres, Auth, Storage, Realtime,
Studio, a fake mail server) on your machine in Docker. You develop against it
instead of the shared cloud project — no risk to real data, all 14 migrations
applied, instant resets.

## Prerequisites

- **Docker**, running. On macOS, [OrbStack](https://orbstack.dev) or Docker
  Desktop both work.
- **Supabase CLI** — no install needed; we invoke it with `npx supabase ...`.
- Repo dependencies installed: `npm install`.

## 1. Start the stack

```bash
npx supabase start
```

First run pulls container images (a few minutes). When it finishes it prints
your local URLs and keys. Useful endpoints:

| What | URL |
|---|---|
| API (Postgres REST / Auth / Storage) | http://127.0.0.1:54321 |
| Studio (DB browser / SQL editor) | http://localhost:54323 |
| Inbucket (captured emails + OTPs) | http://localhost:54324 |
| Postgres (direct) | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Other handy commands:

```bash
npx supabase status     # reprint URLs/keys anytime
npx supabase stop       # stop the stack (data persists)
npx supabase db reset   # wipe + re-apply ALL migrations from scratch
```

## 2. Point the app at it

The app reads `EXPO_PUBLIC_*` vars, and Expo prefers `.env.local` over `.env`.
Create `.env.local` in the repo root:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

The anon key above is the **standard local demo key** — identical on every
Supabase local install, safe to commit/share. (Confirm with `npx supabase status`.)

`.env.local` is gitignored. **Delete or rename it to point the app back at the
cloud project.**

> **Physical device via Expo Go:** `127.0.0.1` only works from the iOS
> simulator. On a real phone, replace it with your Mac's LAN IP, e.g.
> `http://192.168.1.20:54321` (your phone must be on the same Wi-Fi).

Restart the Expo dev server after editing env vars — they're inlined into the
bundle at build time.

## 3. (Optional) Seed it with real data from cloud

A fresh local DB has the schema but no rows. To copy the cloud project's data
(auth users you can log in as + listings/messages/etc.):

```bash
# Session pooler URI from Dashboard -> Project Settings -> Database.
# URL-encode special chars in the password (! -> %21, ? -> %3F).
CLOUD_DB_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres" \
  ./scripts/pull-cloud-data.sh
```

This wipes the local DB, re-applies migrations, and loads the cloud data. See
`scripts/pull-cloud-data.sh` for details and caveats. After it runs you can log
in as any cloud user with their real password; captured OTP/reset emails land in
Inbucket (http://localhost:54324), not a real inbox.

> No storage *files* come across (only bucket definitions), so avatars/listing
> images render as broken URLs until re-uploaded locally — expected.

## 4. Run the SQL test suites (optional)

```bash
for f in supabase/tests/*.sql; do
  echo "== $f =="
  docker exec -i supabase_db_new_Axis \
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$f"
done
```

Each runs in a transaction and rolls back, leaving no residue; it raises on the
first failed assertion.

## Troubleshooting

- **`db reset` errors on a migration** — read the failing statement; the local
  schema is the source of truth, fix the migration and reset again.
- **Port already in use** — another stack is running; `npx supabase stop` (or
  stop the other project) and retry.
- **App still hits cloud** — you have a stale `.env`/build; confirm `.env.local`
  exists and restart the Expo server (`r` won't re-read env — fully restart).
- **`pull-cloud-data.sh` connection hangs** — you used the direct
  `db.<ref>.supabase.co` host (IPv6-only). Use the **session pooler** host
  (`aws-1-<region>.pooler.supabase.com`, port 5432, user `postgres.<ref>`).
