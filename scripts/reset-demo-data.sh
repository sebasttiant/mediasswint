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

If pnpm is available on the host, the script runs with host pnpm and loads DATABASE_URL
from .env at the repo root when it is not already exported.

If pnpm is not available, the script falls back to Docker Compose and runs the existing
template-seeder service, whose DATABASE_URL points to the postgres service.
USAGE
}

compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    printf '%s\n' "docker compose"
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    printf '%s\n' "docker-compose"
    return 0
  fi

  return 1
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

if command -v pnpm >/dev/null 2>&1; then
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
else
  if ! compose_command="$(compose_cmd)"; then
    usage >&2
    echo "Error: pnpm or Docker Compose is required." >&2
    exit 1
  fi

  env_args=()
  if [[ "${DEMO_FULL_RESET:-}" == "1" ]]; then
    env_args+=("-e" "DEMO_FULL_RESET=1")
  fi
  if [[ "${DEMO_DELETE_USERS:-}" == "1" ]]; then
    env_args+=("-e" "DEMO_DELETE_USERS=1")
  fi

  read -r -a compose_parts <<<"$compose_command"
  (cd "$ROOT_DIR" && "${compose_parts[@]}" run --rm "${env_args[@]}" template-seeder pnpm exec tsx scripts/reset-demo-data.ts)
fi
