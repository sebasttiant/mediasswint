#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage: scripts/seed-demo-data.sh

Loads deterministic demo data into the configured DATABASE_URL:
- 10 Colombian demo patients
- 10 completed measurement sessions using the compression template
- Commercial operations and matching payment movements
- Demo expenses and daily cash counts for Caja y Finanzas

The seed is re-runnable. It first removes rows marked as demo data, then inserts a fresh dataset.
It does not delete auth users. It keeps measurement templates, but syncs the compression template if needed.

Required environment:
  DATABASE_URL=postgresql://...

If DATABASE_URL is not already exported, the script loads it from .env at the repo root.
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

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

pnpm --dir "$ROOT_DIR/apps/web" exec tsx scripts/seed-demo-data.ts
