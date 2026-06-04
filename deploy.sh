#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

# Safe VPS deploy for mediasswint.
#
# What this script does, in order:
# 1. Creates a compressed backup of the current app directory.
# 2. Creates a PostgreSQL logical dump when the DB container is running.
# 3. Creates compressed Docker volume snapshots for Postgres and Redis volumes.
# 4. Pulls the latest code from the selected branch.
# 5. Rebuilds and recreates the Docker Compose stack.
# 6. Verifies the web health endpoint.
#
# Default VPS location expected by the owner:
#   /opt/docker/swmedias

APP_DIR="${APP_DIR:-/opt/docker/swmedias}"
BRANCH="${BRANCH:-main}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/docker/backups/swmedias}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
# APP_PORT and HEALTH_URL are resolved after loading .env so the health check
# matches the host port used by docker-compose.
APP_PORT="${APP_PORT:-}"
HEALTH_URL="${HEALTH_URL:-}"

PROJECT_NAME="${PROJECT_NAME:-mediasswint}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mediasswint-postgres}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-mediasswint_postgres_data}"
REDIS_VOLUME="${REDIS_VOLUME:-mediasswint_redis_data}"

LOCK_FILE="${LOCK_FILE:-/tmp/mediasswint-deploy.lock}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

compose() {
  docker compose -p "$PROJECT_NAME" -f "$APP_DIR/$COMPOSE_FILE" "$@"
}

load_env_defaults() {
  # Load only simple KEY=value lines used by docker-compose defaults.
  # Do not print secrets.
  if [[ -f "$APP_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env"
    set +a
  fi

  POSTGRES_USER="${POSTGRES_USER:-mediass}"
  POSTGRES_DB="${POSTGRES_DB:-mediass}"
  APP_PORT="${APP_PORT:-3131}"
  HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${APP_PORT}/api/health}"
}

ensure_preconditions() {
  require_command docker
  require_command git
  require_command tar
  require_command gzip
  require_command curl
  require_command flock
  require_command find

  [[ -d "$APP_DIR" ]] || fail "APP_DIR does not exist: $APP_DIR"
  [[ -f "$APP_DIR/$COMPOSE_FILE" ]] || fail "Compose file not found: $APP_DIR/$COMPOSE_FILE"
  [[ -d "$APP_DIR/.git" ]] || fail "APP_DIR is not a git repo: $APP_DIR"

  mkdir -p "$BACKUP_DIR"
}

backup_app_directory() {
  log "Backing up app directory"

  tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='apps/web/node_modules' \
    --exclude='apps/web/.next' \
    --exclude='.turbo' \
    --exclude='coverage' \
    --exclude='tmp' \
    -czf "$BACKUP_DIR/app-source-${TIMESTAMP}.tar.gz" \
    -C "$(dirname "$APP_DIR")" "$(basename "$APP_DIR")"
}

backup_postgres_dump() {
  log "Backing up PostgreSQL database with pg_dump"

  if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
    log "Postgres container is not running: $POSTGRES_CONTAINER"
    log "Skipping logical DB dump. This is acceptable only for first deploys or empty VPS setups."
    return 0
  fi

  docker exec "$POSTGRES_CONTAINER" \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges \
    > "$BACKUP_DIR/postgres-${POSTGRES_DB}-${TIMESTAMP}.dump"

  gzip -9 "$BACKUP_DIR/postgres-${POSTGRES_DB}-${TIMESTAMP}.dump"
}

backup_docker_volume() {
  local volume_name="$1"
  local backup_name="$2"

  if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
    log "Docker volume does not exist yet, skipping: $volume_name"
    return 0
  fi

  log "Backing up Docker volume: $volume_name"

  docker run --rm \
    -v "${volume_name}:/volume:ro" \
    -v "${BACKUP_DIR}:/backup" \
    alpine:3.22 \
    tar -czf "/backup/${backup_name}-${TIMESTAMP}.tar.gz" -C /volume .
}

write_backup_manifest() {
  log "Writing backup manifest"

  {
    printf 'timestamp=%s\n' "$TIMESTAMP"
    printf 'app_dir=%s\n' "$APP_DIR"
    printf 'branch=%s\n' "$BRANCH"
    printf 'compose_file=%s\n' "$COMPOSE_FILE"
    printf 'project_name=%s\n' "$PROJECT_NAME"
    printf 'postgres_container=%s\n' "$POSTGRES_CONTAINER"
    printf 'postgres_db=%s\n' "$POSTGRES_DB"
    printf 'postgres_volume=%s\n' "$POSTGRES_VOLUME"
    printf 'redis_volume=%s\n' "$REDIS_VOLUME"
    printf 'git_before=%s\n' "$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true)"
  } > "$BACKUP_DIR/manifest.txt"
}

update_code() {
  log "Updating code from origin/${BRANCH}"

  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
}

deploy_stack() {
  log "Building and recreating Docker Compose stack"

  compose up -d --build --force-recreate
}

verify_health() {
  log "Verifying health endpoint: $HEALTH_URL"

  for attempt in {1..30}; do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      log "Health check passed"
      compose ps
      return 0
    fi

    log "Health check not ready yet (${attempt}/30). Waiting 5s..."
    sleep 5
  done

  compose ps || true
  compose logs --no-color --tail=120 web || true
  fail "Health check failed after waiting. Backup is available at: $BACKUP_DIR"
}

cleanup_old_backups() {
  log "Removing backups older than ${BACKUP_KEEP_DAYS} days"

  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_KEEP_DAYS}" -print -exec rm -rf {} +
}

main() {
  exec 9>"$LOCK_FILE"
  flock -n 9 || fail "Another deploy is already running. Lock: $LOCK_FILE"

  ensure_preconditions
  load_env_defaults

  log "Starting deploy"
  log "App dir: $APP_DIR"
  log "Backup dir: $BACKUP_DIR"

  backup_app_directory
  backup_postgres_dump
  backup_docker_volume "$POSTGRES_VOLUME" "postgres-volume"
  backup_docker_volume "$REDIS_VOLUME" "redis-volume"
  write_backup_manifest

  update_code
  deploy_stack
  verify_health
  cleanup_old_backups

  log "Deploy finished successfully"
  log "Backup saved at: $BACKUP_DIR"
}

main "$@"
