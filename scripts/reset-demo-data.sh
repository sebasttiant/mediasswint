#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage: scripts/reset-demo-data.sh [--full] [--delete-users]

Safely removes demo/business data from the configured DATABASE_URL.

Default behavior:
- Deletes rows marked as demo data: payments, expenses, daily cash counts, commercial operations,
  measurement values, measurement sessions, patients, and related demo audit logs.
- Keeps auth users.
- Keeps measurement templates.

Full reset:
- Pass --full or set DEMO_FULL_RESET=1 to delete all business rows and the compression template.
- Users are still kept unless --delete-users or DEMO_DELETE_USERS=1 is also set.

Required environment:
  DATABASE_URL=postgresql://...

If DATABASE_URL is not already exported, the script loads it from .env at the repo root.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      usage
      exit 0
      ;;
    --full)
      export DEMO_FULL_RESET=1
      ;;
    --delete-users)
      export DEMO_DELETE_USERS=1
      ;;
    *)
      usage >&2
      echo "Error: unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  usage >&2
  echo "Error: DATABASE_URL is required." >&2
  exit 1
fi

pnpm --dir "$ROOT_DIR/apps/web" exec tsx scripts/reset-demo-data.ts
