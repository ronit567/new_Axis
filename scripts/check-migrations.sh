#!/bin/sh
# check-migrations.sh — report which local migrations are missing from the
# linked remote Supabase project, and refuse to be quiet about the ones that
# carry App Store compliance behaviour.
#
# Why this exists: PRODUCTION_AUDIT.md found prod running 14 of 21 migrations
# while the repo shipped code that assumed all 21. The same drift now has teeth
# — 0032-0036 are what Guideline 1.2 compliance actually rests on, and an
# unapplied 0035 means App Review cannot sign in at all.
#
# This script only READS. Applying is a separate, deliberate `supabase db push`.
#
# Usage:
#   sh scripts/check-migrations.sh
#
# Requires the project to be linked first (one time, interactive):
#   npx supabase login
#   npx supabase link --project-ref <your-project-ref>

set -u

FAIL=0

echo "==> Migration drift check"

# ── Preconditions ───────────────────────────────────────────────────────────
if ! npx --no-install supabase --version >/dev/null 2>&1; then
  echo "FATAL: supabase CLI not available. Run: npm i -D supabase"
  exit 1
fi

if [ ! -f supabase/.temp/project-ref ]; then
  echo "FATAL: no linked project."
  echo "       Run: npx supabase login && npx supabase link --project-ref <ref>"
  echo "       (the ref is in your Supabase dashboard URL)"
  exit 1
fi

echo "    linked project: $(cat supabase/.temp/project-ref)"
echo ""

# ── Remote vs local ─────────────────────────────────────────────────────────
# `migration list` prints a three-column table: Local | Remote | time. A row
# with a local version and an empty remote column has not been applied.
LIST=$(npx --no-install supabase migration list 2>&1) || {
  echo "FATAL: could not reach the remote project."
  echo "$LIST"
  exit 1
}

echo "$LIST"
echo ""

PENDING=$(echo "$LIST" \
  | grep -E '^[[:space:]]*[0-9]{4,}' \
  | awk -F'|' '{ gsub(/ /,"",$1); gsub(/ /,"",$2); if ($1 != "" && $2 == "") print $1 }')

if [ -z "$PENDING" ]; then
  echo "PASS: every local migration is applied to the remote project."
else
  echo "PENDING migrations (present locally, absent remotely):"
  for m in $PENDING; do
    DESC=$(ls supabase/migrations/ | grep "^${m}" | head -1)
    echo "  - ${DESC:-$m}"
  done
  FAIL=1
fi

echo ""

# ── Compliance-critical subset ──────────────────────────────────────────────
# These five are the ones an App Review rejection would trace back to. Called
# out by name so a long pending list can't bury them.
echo "==> Compliance-critical migrations"
for pair in \
  "0032:content filter (Guideline 1.2 — objectionable material)" \
  "0033:blocked users list (Guideline 1.2 — blocking)" \
  "0034:authenticated browse (Guideline 5.1 — profile exposure)" \
  "0035:App Review demo account (Guideline 2.1 — reviewer sign-in)" \
  "0036:rate limits (Guideline 1.2 — report queue integrity)" \
  "0037:drop dev test RPC (Guideline 2.3.1 — no hidden features)"
do
  NUM=${pair%%:*}
  WHY=${pair#*:}
  if echo "$PENDING" | grep -q "^${NUM}"; then
    echo "  MISSING  $NUM — $WHY"
    FAIL=1
  else
    echo "  applied  $NUM — $WHY"
  fi
done

echo ""

# ── Manual dashboard steps the schema cannot prove ───────────────────────────
# These are not migrations and this script cannot verify them. Listed so they
# are checked at the same moment as the drift.
echo "==> Verify by hand in the Supabase dashboard (not checkable from SQL)"
echo "  [ ] Auth hook 'before_user_created' is enabled and points at"
echo "      hook_restrict_signup_email (0018) — without it the @uwo.ca gate and"
echo "      the deleted-account cooldown are both off."
echo "  [ ] Email confirmations are ON (config.toml ships them off for local)."
echo "  [ ] Leaked-password protection is ON; minimum length >= 8."
echo "  [ ] The App Review demo user EXISTS in Authentication -> Users with"
echo "      'Auto Confirm User' ticked. 0035 only whitelists the address; it"
echo "      does not create the account."
echo "  [ ] (0037 now drops create_test_notification automatically — verify it applied.)"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "==> Migration drift check PASSED (dashboard items still need a human)."
else
  echo "==> Migration drift check FAILED."
  echo "    Apply with: npx supabase db push"
  echo "    Then re-run this script and the suites in supabase/tests/."
fi

exit "$FAIL"
