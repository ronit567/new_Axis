#!/bin/sh
# store-readiness.sh — one deterministic answer to "is everything a machine can
# check about the iOS App Store submission green?"
#
# Why this exists: readiness was spread over a compliance guard, a docket, two
# planning documents and App Store Connect, and "ready" was an opinion. This
# script is the single thing that gets to print PASS, and it only does so from
# evidence it gathered itself on this run.
#
# It does NOT mean "clear to submit". Privacy labels, screenshots, the demo
# accounts and a walkthrough on a real iPhone cannot be seen from here; they
# live in the "NEEDS YOU" section of docs/STORE_READINESS.md.
#
# This script only READS. It never builds, submits, pushes or touches the
# production database. There is deliberately no flag to skip a gate.
#
# Usage:
#   npm run check:store
#
# The last line is always one of:
#   STORE-READINESS: PASS
#   STORE-READINESS: FAIL <number of failed checks>

set -u

LEDGER="docs/STORE_READINESS.md"
METADATA_DIR="store/metadata"
REVIEW_NOTES="store/REVIEW_NOTES.md"
GUARD="${APP_STORE_GUARD:-$HOME/.claude/hooks/app-store-compliance-guard.sh}"
SKILL_DIR="${APP_STORE_SKILL_DIR:-$HOME/.claude/skills/app-store-compliance}"
LEGAL_URLS="https://dataaxis.org/privacy https://dataaxis.org/terms https://dataaxis.org/guidelines https://dataaxis.org/support"

FAILS=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILS=$((FAILS + 1)); }

# Run a command quietly; on failure show the tail so the cause is in the log.
run_check() {
  label=$1
  shift
  if "$@" >"$TMP/out" 2>&1; then
    pass "$label"
  else
    fail "$label"
    tail -n 15 "$TMP/out" | sed 's/^/      /'
  fi
}

# Rows of the markdown table under a given "## Heading" in the ledger, without
# the header and separator rows.
ledger_rows() {
  awk -v h="## $1" '
    $0 == h { on = 1; next }
    /^## / { on = 0 }
    on && /^\|/ { n++; if (n > 2) print }
  ' "$LEDGER"
}

echo "==> Store readiness gate (iOS)"

if [ ! -f "$LEDGER" ]; then
  echo "FATAL: $LEDGER not found. Every gate below reads it."
  echo "STORE-READINESS: FAIL 1"
  exit 1
fi

# ── G1 Code health ──────────────────────────────────────────────────────────
echo ""
echo "--- G1 Code health"
run_check "typecheck (tsc --noEmit)" npx tsc --noEmit
run_check "tests (jest)" npx jest --ci --silent
run_check "architecture guard" sh scripts/check-architecture.sh

# ── G2 Compliance guard ─────────────────────────────────────────────────────
# A HIGH finding clears only by disappearing or by a waiver row that points at
# real evidence. The guard itself is pinned by checksum, so the cheap way out —
# editing the scanner — fails this gate instead of passing it.
echo ""
echo "--- G2 Compliance guard"
if [ ! -f "$GUARD" ]; then
  fail "compliance guard not found at $GUARD"
else
  WANT_SHA=$(sed -n 's/^Guard checksum: `\([0-9a-f]*\)`.*/\1/p' "$LEDGER" | head -n 1)
  HAVE_SHA=$(shasum -a 256 "$GUARD" | cut -d' ' -f1)
  if [ -n "$WANT_SHA" ] && [ "$WANT_SHA" = "$HAVE_SHA" ]; then
    pass "guard matches the checksum recorded in the ledger"
  else
    fail "guard checksum differs from the ledger (have $HAVE_SHA)"
  fi

  bash "$GUARD" "$PWD" >"$TMP/guard" 2>&1
  SUMMARY=$(grep -E '^Summary\. critical=' "$TMP/guard" | tail -n 1)
  if [ -z "$SUMMARY" ]; then
    fail "guard printed no summary line"
  else
    echo "    $SUMMARY"
    CRIT=$(echo "$SUMMARY" | sed 's/.*critical=\([0-9]*\).*/\1/')
    if [ "$CRIT" = "0" ]; then
      pass "no critical findings"
    else
      fail "$CRIT critical finding(s) — release blocker"
      grep -E '^\s*\[CRITICAL\]\s+[A-Z]+-' "$TMP/guard" | sed 's/^/      /'
    fi

    ledger_rows "Guard waivers" >"$TMP/waivers"
    grep -E '^\s*\[HIGH\]\s+[A-Z]+-' "$TMP/guard" | awk '{print $2}' | sort -u >"$TMP/highs"
    while read -r ID; do
      [ -n "$ID" ] || continue
      ROW=$(grep -F "| $ID |" "$TMP/waivers" | head -n 1)
      if [ -z "$ROW" ]; then
        fail "HIGH $ID is neither fixed nor waived"
        continue
      fi
      # Evidence is the third cell: `path:line`, and the line has to exist.
      EV=$(echo "$ROW" | awk -F'|' '{print $3}' | tr -d ' `')
      EV_FILE=${EV%%:*}
      EV_LINE=${EV##*:}
      case "$EV_LINE" in ''|*[!0-9]*) EV_LINE=0 ;; esac
      if [ -f "$EV_FILE" ] && [ "$EV_LINE" -gt 0 ] && [ "$(wc -l <"$EV_FILE")" -ge "$EV_LINE" ]; then
        pass "HIGH $ID waived with evidence $EV"
      else
        fail "HIGH $ID waiver evidence '$EV' is not a real file:line"
      fi
    done <"$TMP/highs"
  fi
fi

# ── G3 Build configuration ──────────────────────────────────────────────────
echo ""
echo "--- G3 Build configuration"
if grep -q 'REPLACE_WITH_' eas.json; then
  fail "eas.json still has placeholder identifiers:"
  grep -n 'REPLACE_WITH_' eas.json | sed 's/^/      /'
else
  pass "eas.json has no placeholder identifiers"
fi
run_check "expo config resolves" npx expo config --type public --json
run_check "expo-doctor" npx --yes expo-doctor
run_check "app.json carries the submission fields" node -e '
  const ios = require("./app.json").expo.ios || {};
  const plugins = require("./app.json").expo.plugins || [];
  const picker = (plugins.find((p) => Array.isArray(p) && p[0] === "expo-image-picker") || [])[1] || {};
  const missing = [];
  if (!ios.bundleIdentifier) missing.push("ios.bundleIdentifier");
  if (!ios.buildNumber) missing.push("ios.buildNumber");
  if (typeof (ios.infoPlist || {}).ITSAppUsesNonExemptEncryption !== "boolean")
    missing.push("ios.infoPlist.ITSAppUsesNonExemptEncryption");
  const pm = ios.privacyManifests || {};
  if (!(pm.NSPrivacyAccessedAPITypes || []).length) missing.push("privacyManifests.NSPrivacyAccessedAPITypes");
  if (!(pm.NSPrivacyCollectedDataTypes || []).length) missing.push("privacyManifests.NSPrivacyCollectedDataTypes");
  for (const k of ["photosPermission", "cameraPermission"])
    if (typeof picker[k] !== "string" || picker[k].length < 20) missing.push("expo-image-picker." + k);
  if (missing.length) { console.error("missing: " + missing.join(", ")); process.exit(1); }
'

# ── G4 Privacy consistency ──────────────────────────────────────────────────
# The privacy manifest, the App Store labels and the published policy were all
# written against a known set of SDKs. A dependency nobody reviewed is how those
# three drift apart from what the binary really does.
echo ""
echo "--- G4 Privacy consistency"
ledger_rows "Reviewed dependencies" | awk -F'|' '{print $2}' | tr -d ' `' | sort -u >"$TMP/reviewed"
node -e 'Object.keys(require("./package.json").dependencies).forEach((d) => console.log(d))' | sort -u >"$TMP/deps"
UNREVIEWED=$(comm -23 "$TMP/deps" "$TMP/reviewed")
if [ -z "$UNREVIEWED" ]; then
  pass "every runtime dependency has a privacy review row"
else
  fail "dependencies with no privacy review row in the ledger:"
  echo "$UNREVIEWED" | sed 's/^/      /'
fi

# ── G5 Legal URLs ───────────────────────────────────────────────────────────
echo ""
echo "--- G5 Legal URLs"
for URL in $LEGAL_URLS; do
  CODE=$(curl -sS -L -o /dev/null --max-time 20 -w '%{http_code}' "$URL" 2>/dev/null || echo 000)
  if [ "$CODE" = "200" ]; then
    pass "$URL"
  else
    fail "$URL returned $CODE"
  fi
done

# ── G6 Listing and review notes ─────────────────────────────────────────────
# metadata-audit.py exits 0 when it finds no metadata at all, and when it finds
# only HIGH findings, so its exit code is not used here. The summary line is.
echo ""
echo "--- G6 Listing and review notes"
AUDIT="$SKILL_DIR/scripts/metadata-audit.py"
if [ ! -d "$METADATA_DIR" ]; then
  fail "$METADATA_DIR does not exist — the listing has not been drafted"
elif [ ! -f "$AUDIT" ]; then
  fail "metadata audit not found at $AUDIT"
else
  # python.org builds on this machine have no CA bundle; without this every
  # URL check reports unreachable.
  CERTS=$(python3 -c 'import certifi;print(certifi.where())' 2>/dev/null || true)
  [ -n "$CERTS" ] && export SSL_CERT_FILE="$CERTS"

  python3 "$AUDIT" "$METADATA_DIR" --check-urls >"$TMP/meta" 2>&1
  FIELDS=$(sed -n 's/^Fields audited\. //p' "$TMP/meta")
  for F in name subtitle keywords description privacy_url support_url; do
    case ", $FIELDS," in
      *", $F,"*) ;;
      *) fail "listing field '$F' is missing from $METADATA_DIR" ;;
    esac
  done
  MSUM=$(grep -E '^Summary\. critical=' "$TMP/meta" | tail -n 1)
  case "$MSUM" in
    "Summary. critical=0 high=0 "*) pass "metadata audit: $MSUM" ;;
    "") fail "metadata audit found nothing to audit" ;;
    *)
      fail "metadata audit: $MSUM"
      grep -A2 -E '^\s*\[(CRITICAL|HIGH)\]' "$TMP/meta" | sed 's/^/      /'
      ;;
  esac
fi

if [ ! -f "$REVIEW_NOTES" ]; then
  fail "$REVIEW_NOTES does not exist"
else
  # Credentials never belong in the repo, so an unfilled template slot is the
  # only thing looked for here: <like this>, TODO or REPLACE.
  LEFT=$(grep -nE '<[^>]+>|TODO|REPLACE' "$REVIEW_NOTES" || true)
  if [ -z "$LEFT" ]; then
    pass "review notes have no unfilled placeholders"
  else
    fail "review notes still have placeholders:"
    echo "$LEFT" | sed 's/^/      /'
  fi
fi

# ── G7 Ledger ───────────────────────────────────────────────────────────────
echo ""
echo "--- G7 Ledger"
OPEN=$(ledger_rows "Items" | awk -F'|' '
  { o = $4; s = $5; gsub(/ /, "", o); gsub(/ /, "", s) }
  o == "agent" && s == "open" { print }
')
if [ -z "$OPEN" ]; then
  pass "no open items owned by the agent"
else
  fail "open items owned by the agent:"
  echo "$OPEN" | awk -F'|' '{print "      " $2 "—" $6}'
fi
NEEDS=$(ledger_rows "Items" | awk -F'|' '
  { o = $4; s = $5; gsub(/ /, "", o); gsub(/ /, "", s) }
  o == "you" && s == "open" { n++ }
  END { print n + 0 }
')
echo "    $NEEDS open item(s) need you — see the NEEDS YOU section of $LEDGER"

echo ""
if [ "$FAILS" -eq 0 ]; then
  echo "Machine-checkable gates are green. This is not a clearance to submit:"
  echo "$NEEDS item(s) in $LEDGER can only be done by a person."
  echo "STORE-READINESS: PASS"
  exit 0
else
  echo "STORE-READINESS: FAIL $FAILS"
  exit 1
fi
