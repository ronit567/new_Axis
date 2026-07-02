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
#   2. WARNING — nothing should import `src/data/mockListings`. This is only a
#               warning FOR NOW because mock data is still legitimately used by
#               several screens. It becomes FATAL after AX-299 deletes the mock
#               file (flip WARN_ONLY_MOCK=0 below at that point).

set -u

# Flip to 0 after AX-299 lands to make the mockListings guard fatal.
WARN_ONLY_MOCK=1

FAIL=0

echo "==> Architecture guard (AX-902)"

# --- Rule 1: no direct Supabase imports in screens/components (FATAL) --------
SUPA_DIRS=""
for d in src/screens src/components; do
  [ -d "$d" ] && SUPA_DIRS="$SUPA_DIRS $d"
done

if [ -n "$SUPA_DIRS" ]; then
  # Match: lib/supabase (e.g. '../lib/supabase', '@/lib/supabase') or the raw SDK.
  SUPA_HITS=$(grep -rnE "(lib/supabase)|(@supabase/supabase-js)" $SUPA_DIRS 2>/dev/null || true)
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

# --- Rule 2: no mockListings imports (WARNING until AX-299) ------------------
if [ -d src ]; then
  MOCK_HITS=$(grep -rnE "data/mockListings" src 2>/dev/null || true)
  if [ -n "$MOCK_HITS" ]; then
    if [ "$WARN_ONLY_MOCK" -eq 1 ]; then
      echo "WARNING: import(s) of src/data/mockListings found (allowed for now; becomes FATAL after AX-299):"
      echo "$MOCK_HITS" | sed 's/^/  /'
    else
      echo "FAIL: import(s) of src/data/mockListings found (mock data must be gone post-AX-299):"
      echo "$MOCK_HITS" | sed 's/^/  /'
      FAIL=1
    fi
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
