#!/usr/bin/env bash
# staging-auth-smoke.sh
# Release-gate smoke test for SDD change `user-model-and-password-hashing`.
# Executes the 12-step live-Postgres checklist against a real environment.
# Until this passes, the change is archived but NOT released.
#
# Required env vars (export before running):
#   STAGING_BASE_URL    e.g. https://staging.mediasswint.example
#   DATABASE_URL        libpq URL reachable from this host (target Postgres)
#   AUTH_USER           operator email used to bootstrap (lowercased automatically)
#   AUTH_PASSWORD_A     initial password
#   AUTH_PASSWORD_B     rotated password (must differ from A)
#   BOOTSTRAP_CMD       shell command that runs auth:bootstrap reading
#                       AUTH_USER and AUTH_PASSWORD from the env. Examples:
#                         "pnpm --filter @mediasswint/web auth:bootstrap"
#                         "docker run --rm --network host \
#                            -e DATABASE_URL -e AUTH_USER -e AUTH_PASSWORD \
#                            mediasswint/bootstrapper:latest"
#
# Optional:
#   BOGUS_EMAIL         defaults to bogus-<epoch>@example.invalid
#
# Requires on PATH: psql, curl, jq, python3 (for cookie payload decode).
#
# Exits 0 if all 12 steps pass, 1 on any failure (per archive rollback policy).

set -euo pipefail

# ---------- env validation ----------
require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "[ERROR] missing env var: $name" >&2
    exit 2
  fi
}
require STAGING_BASE_URL
require DATABASE_URL
require AUTH_USER
require AUTH_PASSWORD_A
require AUTH_PASSWORD_B
require BOOTSTRAP_CMD

if [ "$AUTH_PASSWORD_A" = "$AUTH_PASSWORD_B" ]; then
  echo "[ERROR] AUTH_PASSWORD_A and AUTH_PASSWORD_B must differ (rotation test)" >&2
  exit 2
fi

BOGUS_EMAIL="${BOGUS_EMAIL:-bogus-$(date +%s)@example.invalid}"
LOGIN_URL="$STAGING_BASE_URL/api/auth/login"

# ---------- helpers ----------
PASS=0
FAIL=0
step()  { printf "\n— STEP %s — %s\n" "$1" "$2"; }
pass()  { printf "  ✓ PASS — %s\n" "$1"; PASS=$((PASS+1)); }
fail()  { printf "  ✗ FAIL — %s\n" "$1"; FAIL=$((FAIL+1)); }

run_bootstrap() {
  # Exports AUTH_PASSWORD only for this invocation; AUTH_USER + DATABASE_URL
  # are inherited from the outer shell.
  local password="$1"
  AUTH_PASSWORD="$password" bash -c "$BOOTSTRAP_CMD"
}

psql_q() {
  # tuples-only, unaligned, single-shot. Booleans display as t/f, columns
  # separated by '|'.
  psql "$DATABASE_URL" -tA -c "$1"
}

decode_payload() {
  # Decode base64url payload (first segment of the session cookie) to JSON.
  local encoded="$1"
  python3 - "$encoded" <<'PY'
import base64, json, sys
s = sys.argv[1]
s += "=" * (-len(s) % 4)
s = s.replace("-", "+").replace("_", "/")
print(json.dumps(json.loads(base64.b64decode(s).decode())))
PY
}

extract_session_cookie() {
  # Reads a `curl -i` response from stdin and prints the value of the
  # mediasswint_session cookie if present, empty otherwise.
  awk '
    /^\r?$/ { in_body=1 }
    in_body { next }
    tolower($1)=="set-cookie:" {
      sub(/^[Ss]et-[Cc]ookie:[ \t]*/, "")
      if (match($0, /mediasswint_session=[^;]*/)) {
        v = substr($0, RSTART, RLENGTH)
        sub(/^mediasswint_session=/, "", v)
        print v
        exit
      }
    }
  '
}

http_status() {
  awk 'NR==1 {print $2; exit}' "$1"
}

login_payload() {
  jq -nc --arg u "$1" --arg p "$2" '{user:$u, password:$p}'
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ---------- step 1: bootstrap with PASS_A ----------
step 1 "bootstrap (PASS_A)"
out1=$(run_bootstrap "$AUTH_PASSWORD_A")
echo "$out1"
ID1=$(printf '%s\n' "$out1" | sed -n 's/.*provisioned user[^(]*(\([^)]*\)).*/\1/p' | tail -n1)
if [ -n "$ID1" ]; then pass "ID1=$ID1"; else fail "could not parse user id"; exit 1; fi

# ---------- step 2: verify User row ----------
step 2 "verify User row in Postgres"
row=$(psql_q "SELECT id, email, \"isActive\", left(\"passwordHash\",10), \"passwordHash\" FROM \"User\" WHERE id='${ID1//\'/\'\'}';")
echo "  row: ${row%%|*}|<email>|<active>|<prefix>|<hash-omitted>"
IFS='|' read -r r_id r_email r_active r_hash_prefix r_hash_full <<<"$row"
[ "$r_id" = "$ID1" ]                && pass "id matches"          || fail "id mismatch ($r_id)"
[ "$r_active" = "t" ]               && pass "isActive=t"          || fail "isActive=$r_active"
[ "$r_hash_prefix" = "\$argon2id\$" ] && pass "hash prefix \$argon2id\$" || fail "hash prefix=$r_hash_prefix"
HASH_A="$r_hash_full"

# ---------- step 3: re-bootstrap with PASS_B ----------
step 3 "bootstrap (PASS_B)"
out3=$(run_bootstrap "$AUTH_PASSWORD_B")
echo "$out3"
ID3=$(printf '%s\n' "$out3" | sed -n 's/.*provisioned user[^(]*(\([^)]*\)).*/\1/p' | tail -n1)
[ "$ID3" = "$ID1" ] && pass "same id ($ID1)" || fail "id changed: was $ID1, now $ID3"

# ---------- step 4: idempotence ----------
step 4 "idempotence: one row, hash rotated"
count=$(psql_q "SELECT COUNT(*) FROM \"User\";")
HASH_B=$(psql_q "SELECT \"passwordHash\" FROM \"User\" WHERE id='${ID1//\'/\'\'}';")
[ "$count" = "1" ]      && pass "row count=1"             || fail "row count=$count"
[ "$HASH_A" != "$HASH_B" ] && pass "passwordHash changed" || fail "passwordHash unchanged"

# ---------- step 5: login with PASS_B ----------
step 5 "POST login with valid credentials"
curl -sS -i -o "$TMP/r5.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  -d "$(login_payload "$AUTH_USER" "$AUTH_PASSWORD_B")"
s5=$(http_status "$TMP/r5.http")
cookie=$(extract_session_cookie <"$TMP/r5.http")
[ "$s5" = "200" ]    && pass "HTTP 200"            || fail "HTTP $s5"
[ -n "$cookie" ]     && pass "Set-Cookie present"  || fail "no Set-Cookie"
grep -qi 'httponly' "$TMP/r5.http" && pass "HttpOnly flag" || fail "missing HttpOnly"

# ---------- step 6: cookie sub == ID1, exp ~12h ----------
step 6 "decode session cookie payload"
encoded="${cookie%%.*}"
payload=$(decode_payload "$encoded")
sub=$(printf '%s' "$payload" | jq -r .sub)
exp=$(printf '%s' "$payload" | jq -r .exp)
now=$(date +%s)
delta=$(( exp - now ))
[ "$sub" = "$ID1" ] && pass "sub=$sub" || fail "sub=$sub (expected $ID1)"
# 12h = 43200s. Allow ±5 min slack for clock skew.
if [ "$delta" -ge 42900 ] && [ "$delta" -le 43500 ]; then
  pass "exp ~12h (delta=${delta}s)"
else
  fail "exp delta=${delta}s (expected ~43200 ±300)"
fi

# ---------- step 7: login with old PASS_A → 401 ----------
step 7 "POST login with rotated-out PASS_A"
curl -sS -i -o "$TMP/r7.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  -d "$(login_payload "$AUTH_USER" "$AUTH_PASSWORD_A")"
s7=$(http_status "$TMP/r7.http")
[ "$s7" = "401" ] && pass "HTTP 401" || fail "HTTP $s7"
if [ -z "$(extract_session_cookie <"$TMP/r7.http")" ]; then pass "no Set-Cookie"; else fail "unexpected Set-Cookie"; fi

# ---------- step 8: bogus email → 401 ----------
step 8 "POST login with bogus email"
curl -sS -i -o "$TMP/r8.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  -d "$(login_payload "$BOGUS_EMAIL" "$AUTH_PASSWORD_B")"
s8=$(http_status "$TMP/r8.http")
[ "$s8" = "401" ] && pass "HTTP 401" || fail "HTTP $s8"
if [ -z "$(extract_session_cookie <"$TMP/r8.http")" ]; then pass "no Set-Cookie"; else fail "unexpected Set-Cookie"; fi

# ---------- step 9: not-json body → 400 ----------
step 9 "POST login with non-JSON body"
curl -sS -i -o "$TMP/r9.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  --data-binary 'not-json'
s9=$(http_status "$TMP/r9.http")
[ "$s9" = "400" ] && pass "HTTP 400" || fail "HTTP $s9"
if [ -z "$(extract_session_cookie <"$TMP/r9.http")" ]; then pass "no Set-Cookie"; else fail "unexpected Set-Cookie"; fi

# ---------- step 10: deactivate user → 401 ----------
step 10 "deactivate user, login should 401"
psql_q "UPDATE \"User\" SET \"isActive\"=false WHERE id='${ID1//\'/\'\'}';" >/dev/null
curl -sS -i -o "$TMP/r10.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  -d "$(login_payload "$AUTH_USER" "$AUTH_PASSWORD_B")"
s10=$(http_status "$TMP/r10.http")
[ "$s10" = "401" ] && pass "HTTP 401 with isActive=false" || fail "HTTP $s10"

# ---------- step 11: reactivate → 200 ----------
step 11 "reactivate user, login should 200"
psql_q "UPDATE \"User\" SET \"isActive\"=true WHERE id='${ID1//\'/\'\'}';" >/dev/null
curl -sS -i -o "$TMP/r11.http" -X POST "$LOGIN_URL" \
  -H 'content-type: application/json' \
  -d "$(login_payload "$AUTH_USER" "$AUTH_PASSWORD_B")"
s11=$(http_status "$TMP/r11.http")
[ "$s11" = "200" ] && pass "HTTP 200 with isActive=true" || fail "HTTP $s11"

# ---------- step 12: deploy-ticket summary ----------
step 12 "summary"
printf "\n  env:    %s\n  tester: %s\n  date:   %s\n  ID1:    %s\n  PASS:   %d\n  FAIL:   %d\n" \
  "$STAGING_BASE_URL" "${USER:-unknown}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ID1" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo "  → STOP. Rollback per archive report (sdd/user-model-and-password-hashing/archive-report)."
  exit 1
fi
echo "  → release-gate PASSED. Auth v1 smoke clean against $STAGING_BASE_URL."
