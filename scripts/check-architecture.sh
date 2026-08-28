#!/bin/sh
# check-architecture.sh — mechanical enforcement of the Axis architecture rules
# (see AI_context.md "Architecture Target" and PROJECT_ROADMAP.md AX-902).
#
# Dependency-free: POSIX sh + grep only. No node, no npm packages.
#
# Rules enforced:
#   1. FATAL  — no file under src/screens/ or src/components/ may import the
#               Supabase client (`lib/supabase`) or `@supabase/supabase-js`.
#               Only repositories may talk to Supabase.
#   2. FATAL  — nothing may import `src/data/mockListings`. The mock file was
#               deleted by AX-299; this guard exists to stop it being
#               reintroduced.

set -u

FAIL=0

echo "==> Architecture guard (AX-902)"

# --- Rule 1: no direct Supabase imports in screens/components (FATAL) --------
SUPA_DIRS=""
for d in src/screens src/components; do
  [ -d "$d" ] && SUPA_DIRS="$SUPA_DIRS $d"
done

if [ -n "$SUPA_DIRS" ]; then
  # Match: lib/supabase (e.g. '../lib/supabase', '@/lib/supabase') or the raw SDK.
  # Second grep requires an import/require/export keyword on the line so prose or
  # comments that merely mention the path are not flagged.
  SUPA_HITS=$(grep -rnE "(lib/supabase)|(@supabase/supabase-js)" $SUPA_DIRS 2>/dev/null | grep -Ew "import|require|export" || true)
  if [ -n "$SUPA_HITS" ]; then
    echo "FAIL: direct Supabase import(s) found in screens/components (only repositories may import Supabase):"
    echo "$SUPA_HITS" | sed 's/^/  /'
    FAIL=1
  else
    echo "PASS: no direct Supabase imports in src/screens or src/components."
  fi
else
  echo "SKIP: neither src/screens nor src/components exists."
fi

# --- Rule 2: no mockListings imports (FATAL) --------------------------------
if [ -d src ]; then
  # Require an import/require/export keyword so comments referencing the mock
  # file (e.g. "// mirrors src/data/mockListings.ts") are not flagged.
  MOCK_HITS=$(grep -rnE "data/mockListings" src 2>/dev/null | grep -Ew "import|require|export" || true)
  if [ -n "$MOCK_HITS" ]; then
    echo "FAIL: import(s) of src/data/mockListings found (mock data was deleted by AX-299):"
    echo "$MOCK_HITS" | sed 's/^/  /'
    FAIL=1
  else
    echo "PASS: no imports of src/data/mockListings."
  fi
else
  echo "SKIP: no src directory."
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "==> Architecture guard PASSED."
  exit 0
else
  echo "==> Architecture guard FAILED."
  exit 1
fi
