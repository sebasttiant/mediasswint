#!/usr/bin/env bash
#
# Classify a pnpm audit JSON report (pnpm 12.x schema) and fail on HIGH /
# CRITICAL advisories that are not a current row in security/audit-exceptions.json.
#
# Adapted from ILASESORIAS webnueva audit-gate for this monorepo.
#
# Exit 0: valid report, no blocking findings (or all covered by current exceptions).
# Exit 1: valid report with uncovered HIGH/CRITICAL.
# Exit 2: missing, empty, invalid JSON, auditor error, or unexpected schema.
#
# Usage: bash scripts/audit-gate.sh [audit.json]
# If no file is given, runs `pnpm audit --json` from the repo root.
# AUDIT_EXCEPTIONS overrides the exceptions file (tests).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXCEPTIONS="${AUDIT_EXCEPTIONS:-$ROOT/security/audit-exceptions.json}"
AUDIT="${1:-}"
TODAY="$(date -u +%F)"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }
fail() { log "ERROR: $*"; exit 2; }

[ -s "$EXCEPTIONS" ] || fail "missing $EXCEPTIONS"

if [ -z "$AUDIT" ]; then
  AUDIT="$(mktemp)"
  trap 'rm -f "$AUDIT"' EXIT
  set +e
  (cd "$ROOT" && pnpm audit --json >"$AUDIT")
  pnpm_exit=$?
  set -e
  log "pnpm audit exit ${pnpm_exit}"
fi

[ -e "$AUDIT" ] || fail "audit report not found"
[ -s "$AUDIT" ] || fail "empty audit report"

python3 - "$EXCEPTIONS" "$AUDIT" "$TODAY" <<'PY'
import json
import sys
from datetime import date

exceptions_path, audit_path, today_s = sys.argv[1:4]
today = date.fromisoformat(today_s)

def invalid(message: str) -> None:
    print(f"INVALID_AUDIT: {message}", file=sys.stderr)
    sys.exit(2)

try:
    doc = json.load(open(exceptions_path))
except json.JSONDecodeError as error:
    invalid(f"exceptions JSON: {error}")

if not isinstance(doc, dict) or "exceptions" not in doc:
    invalid("exceptions file must be an object with an exceptions array")
if not isinstance(doc.get("exceptions"), list):
    invalid("exceptions must be an array")

allowed = {}
for item in doc.get("exceptions", []):
    if not isinstance(item, dict) or "id" not in item or "expired_at" not in item:
        invalid("each exception needs id and expired_at")
    exp = date.fromisoformat(item["expired_at"])
    if exp < today:
        print(f"expired exception {item['id']} (expired {item['expired_at']})", file=sys.stderr)
        continue
    allowed[item["id"]] = item

try:
    raw = open(audit_path).read()
except OSError as error:
    invalid(str(error))

if not raw.strip():
    invalid("empty audit report")

try:
    audit = json.loads(raw)
except json.JSONDecodeError as error:
    invalid(f"audit JSON: {error}")

if not isinstance(audit, dict):
    invalid("audit report must be a JSON object")
if audit == {}:
    invalid("empty object is not a pnpm audit report")
if "error" in audit and "metadata" not in audit:
    invalid(f"auditor error: {audit.get('error')}")

meta = audit.get("metadata")
if not isinstance(meta, dict):
    invalid("missing metadata object")
counts = meta.get("vulnerabilities")
if not isinstance(counts, dict):
    invalid("missing metadata.vulnerabilities")
required = ("info", "low", "moderate", "high", "critical")
for key in required:
    value = counts.get(key)
    if type(value) is not int or value < 0:
        invalid(f"metadata.vulnerabilities.{key} must be a non-negative integer")

advisories = audit.get("advisories")
if not isinstance(advisories, dict):
    invalid("missing advisories object (pnpm 12 schema)")

found = {}
advisory_hc = 0
for aid, adv in advisories.items():
    if not isinstance(adv, dict):
        invalid(f"advisory {aid} is not an object")
    sev = (adv.get("severity") or "").lower()
    if sev not in ("high", "critical"):
        continue
    advisory_hc += 1
    ghsa = adv.get("github_advisory_id") or ""
    if not ghsa and isinstance(adv.get("url"), str) and "GHSA-" in adv["url"]:
        ghsa = adv["url"].rstrip("/").split("/")[-1]
    if not ghsa:
        ghsa = f"UNNAMED-{adv.get('module_name')}-{aid}"
    found[ghsa] = {
        "severity": sev,
        "package": adv.get("module_name"),
        "title": adv.get("title"),
        "patched": adv.get("patched_versions"),
    }

meta_hc = counts["high"] + counts["critical"]
if meta_hc != advisory_hc:
    invalid(
        f"metadata high+critical={meta_hc} does not match "
        f"advisory high+critical={advisory_hc}"
    )

print(
    f"VALID_AUDIT high={counts['high']} critical={counts['critical']} "
    f"advisories_hc={advisory_hc}",
    file=sys.stderr,
)

unexpected = sorted(id_ for id_ in found if id_ not in allowed)
if unexpected:
    print("HIGH/CRITICAL advisories without a current exception:", file=sys.stderr)
    for id_ in unexpected:
        info = found[id_]
        print(
            f"  {info['severity']} {id_} {info['package']}: {info['title']}",
            file=sys.stderr,
        )
    sys.exit(1)

print(
    f"audit-gate: {len(found)} HIGH/CRITICAL covered by {len(allowed)} current exceptions"
)
PY
