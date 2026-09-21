// Telling "the database has never heard of this object" apart from "the
// request failed".
//
// WHY THIS EXISTS
//
// Client builds and database migrations deploy on separate tracks in this
// project. The app goes out through EAS/TestFlight; migrations go out by hand
// with `npx supabase db push`. There is therefore always a window in which a
// build in a user's hands is newer than the schema behind it, and a feature
// whose client code and migration were written in the same PR can be running
// against a database that has never seen its table.
//
// That window has already cost a production outage. 0052 added
// public.conversation_hides, and MessageRepository.getMessages started asking
// it whether the user had deleted this thread. The migration had not been
// applied. PostgREST answered that lookup with PGRST205, getMessages threw,
// and the chat screen rendered "Couldn't load messages / Try again" — for
// messages that were sitting in public.messages, perfectly readable, the whole
// time. A brand-new, entirely optional feature (per-user conversation hiding)
// took down a core one (reading your messages).
//
// The rule this encodes: an OPTIONAL read against an object a recent migration
// created should degrade to "no data" when that object is not there yet, and
// must still fail loudly for every other reason. Degrading is only correct
// where the absent data has a safe default — for the hide lookup, "nobody has
// hidden anything", which shows the conversation unfiltered. It is NOT correct
// for a write the user asked for: see hideConversation in MessageRepository.
//
// WHAT POSTGREST ACTUALLY RETURNS
//
// Checked against the PostgREST error reference (docs.postgrest.org
// /references/errors.html) and against postgrest-js itself, which is what
// builds the object this function is handed.
//
//   PGRST205  404  "Could not find the table 'public.x' in the schema cache".
//                  PostgREST resolves the table against a cache it builds at
//                  boot; a table that no migration has created is not in it.
//                  This is what the 0052 incident produced and is the single
//                  most likely code for this class on Supabase today (the code
//                  was introduced in PostgREST 12.2).
//   PGRST202  404  The same thing for a function — a `.rpc()` whose migration
//                  is absent. No caller needs it yet; it is here because the
//                  next repository to degrade an optional RPC will, and the
//                  reasoning is identical.
//   42P01     404  Postgres `undefined_table`. What PostgREST returned for a
//                  missing relation before it had a schema cache to answer
//                  from, and what still surfaces when a statement reaches
//                  Postgres and the relation is gone underneath it. Kept so
//                  this does not silently stop working if Supabase's PostgREST
//                  version moves in either direction.
//   42883     404  Postgres `undefined_function`, the 42P01 of RPCs.
//   42501     403  Postgres `insufficient_privilege` — "permission denied for
//                  table x". This is a schema-lag error too, not an
//                  authorization one: RLS denying a row is NOT an error, it
//                  returns zero rows. A 42501 therefore means the GRANTs the
//                  migration issues (`grant select ... to authenticated`)
//                  have not run — the table exists but the API role cannot see
//                  it, which is the half-applied version of the same problem
//                  and wants the same answer.
//
// DELIBERATELY NOT IN THE LIST
//
//   42703 / PGRST204 — undefined COLUMN. Tempting, because a partly-applied
//   migration could leave a table without a column. But Supabase applies each
//   migration in a transaction, so a table arrives with all of its columns or
//   not at all, whereas a typo in a `.select()` produces exactly this code —
//   and that is a real bug that must be loud. Swallowing it would trade a
//   rare, self-healing failure for a permanent silent one.
//
//   An empty code. postgrest-js reports a failure to reach the server with
//   `code: ''` and `status: 0` (see its PostgrestBuilder: a fetch rejection,
//   an abort, a timeout). That is precisely the case the user SHOULD see as
//   "try again", because trying again may work. It must never be mistaken for
//   a missing table.
//
//   Any 5xx. The server is there and is unwell; retrying is the right
//   response (see retryPolicy.ts), not pretending the feature does not exist.

type ErrorShape = { code?: unknown }

const MISSING_SCHEMA_CODES = new Set([
  'PGRST205',
  'PGRST202',
  '42P01',
  '42883',
  '42501',
])

/**
 * True when the error says the database does not have (or will not expose) the
 * object the query named — a missing table or function, or one whose grants
 * were never issued.
 *
 * Matches on the error code alone. Message text is not consulted on purpose:
 * PostgREST's wording has changed across versions, the codes have not, and a
 * classifier that keys off prose is one release note away from silently
 * swallowing the wrong thing.
 */
export function isMissingSchemaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code } = error as ErrorShape
  return typeof code === 'string' && MISSING_SCHEMA_CODES.has(code)
}
