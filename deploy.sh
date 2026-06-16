#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# ==========================================================================
# mediasswint — safe VPS deploy
#
# Flow:
#   lock -> preflight -> backup -> pull -> build -> db/cache up -> migrate ->
#   bootstrap/seed -> web up -> health check -> cleanup
#
# This project uses a Next.js standalone runtime image. Prisma migrations and
# bootstrap/seed tasks are executed through dedicated Dockerfile targets and
# Compose services, so the production web container stays minimal.
#
# Default VPS location expected by the owner:
#   /opt/docker/swmedias
#
# Common usage on the VPS:
#   ./deploy.sh
#   BRANCH=fix/some-branch ./deploy.sh
# ===========================================================================

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BRANCH="${BRANCH:-main}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/docker/backups/swmedias}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_NAME="${PROJECT_NAME:-mediasswint}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

WEB_SERVICE="${WEB_SERVICE:-web}"
DB_SERVICE="${DB_SERVICE:-postgres}"
REDIS_SERVICE="${REDIS_SERVICE:-redis}"
MIGRATE_SERVICE="${MIGRATE_SERVICE:-migrate}"
AUTH_BOOTSTRAP_SERVICE="${AUTH_BOOTSTRAP_SERVICE:-auth-bootstrap}"
TEMPLATE_SEEDER_SERVICE="${TEMPLATE_SEEDER_SERVICE:-template-seeder}"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mediasswint-postgres}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-mediasswint_postgres_data}"
REDIS_VOLUME="${REDIS_VOLUME:-mediasswint_redis_data}"

APP_PORT="${APP_PORT:-}"
HEALTH_URL="${HEALTH_URL:-}"

LOCK_FILE="${LOCK_FILE:-/tmp/mediasswint-deploy.lock}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

cd "$APP_DIR"

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
  [[ -f "$APP_DIR/.env" ]] || fail "Missing $APP_DIR/.env. Copy env.example/.env.example and fill production values."

  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a

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
  [[ -d "$APP_DIR/.git" ]] || fail "APP_DIR is not a git repo: $APP_DIR"
  [[ -f "$APP_DIR/$COMPOSE_FILE" ]] || fail "Compose file not found: $APP_DIR/$COMPOSE_FILE"

  mkdir -p "$BACKUP_DIR"
}

backup_app_directory() {
  log "Backing up app directory"

  tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='apps/web/node_modules' \
    --exclude='apps/web/.next' \
    --exclude='.next' \
    --exclude='.turbo' \
    --exclude='coverage' \
    --exclude='tmp' \
    --exclude='backups' \
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

build_images() {
  log "Building deploy images"

  compose build \
    "$WEB_SERVICE" \
    "$MIGRATE_SERVICE" \
    "$AUTH_BOOTSTRAP_SERVICE" \
    "$TEMPLATE_SEEDER_SERVICE"
}

container_status() {
  local service="$1"
  local container_id

  container_id="$(compose ps -q "$service")"
  [[ -n "$container_id" ]] || return 1

  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null
}

wait_for_service() {
  local service="$1"
  local expected="$2"
  local deadline
  local status=""

  log "Waiting for '${service}' to become ${expected} (timeout ${HEALTH_TIMEOUT}s)"
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  until status="$(container_status "$service" || true)" && [[ "$status" == "$expected" ]]; do
    if [[ "$(date +%s)" -ge "$deadline" ]]; then
      compose ps || true
      compose logs --no-color --tail=100 "$service" || true
      fail "Service '${service}' did not become ${expected}. Last status: ${status:-unknown}"
    fi
    sleep 3
  done

  log "'${service}' is ${expected}"
}

wait_for_db_or_running() {
  local deadline
  local status=""

  log "Waiting for database service"
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  until status="$(container_status "$DB_SERVICE" || true)" && { [[ "$status" == "healthy" ]] || [[ "$status" == "running" ]]; }; do
    if [[ "$(date +%s)" -ge "$deadline" ]]; then
      compose logs --no-color --tail=100 "$DB_SERVICE" || true
      fail "Database did not become healthy/running. Last status: ${status:-unknown}"
    fi
    sleep 2
  done

  log "Database is ${status}"
}

start_data_services() {
  log "Starting database and Redis"

  compose up -d "$DB_SERVICE" "$REDIS_SERVICE"
  wait_for_db_or_running
  wait_for_service "$REDIS_SERVICE" "healthy"
}

run_migrations() {
  log "Running Prisma migrations via '${MIGRATE_SERVICE}' service"

  compose up -d --no-deps --force-recreate "$MIGRATE_SERVICE"
  wait_for_service "$MIGRATE_SERVICE" "healthy"
}

run_bootstrap_tasks() {
  log "Running auth bootstrap"
  compose run --rm --no-deps "$AUTH_BOOTSTRAP_SERVICE"

  log "Running measurement template seed"
  compose run --rm --no-deps "$TEMPLATE_SEEDER_SERVICE"
}

start_web() {
  log "Starting web container"

  # Dependencies ran explicitly above. --no-deps prevents Compose from rerunning
  # one-shot services while recreating only the web container.
  compose up -d --no-deps --force-recreate "$WEB_SERVICE"
}

verify_health() {
  local deadline

  wait_for_service "$WEB_SERVICE" "healthy"

  log "Verifying health endpoint: $HEALTH_URL"
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  until curl -fsS "$HEALTH_URL" >/dev/null; do
    if [[ "$(date +%s)" -ge "$deadline" ]]; then
      compose ps || true
      compose logs --no-color --tail=120 "$WEB_SERVICE" || true
      fail "Health endpoint failed after waiting. Backup is available at: $BACKUP_DIR"
    fi
    sleep 3
  done

  log "Health endpoint passed"
}

verify_users() {
  log "Verifying users table (informational)"

  compose exec -T "$DB_SERVICE" sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select email, role from \"users\" order by role, email;"' \
    || log "Users verification skipped; web health is already authoritative for deploy success."
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
  log "Branch: $BRANCH"
  log "Backup dir: $BACKUP_DIR"
  log "Health URL: $HEALTH_URL"

  backup_app_directory
  backup_postgres_dump
  backup_docker_volume "$POSTGRES_VOLUME" "postgres-volume"
  backup_docker_volume "$REDIS_VOLUME" "redis-volume"
  write_backup_manifest

  update_code
  build_images
  start_data_services
  run_migrations
  run_bootstrap_tasks
  start_web
  verify_health
  verify_users
  cleanup_old_backups

  log "Final container status"
  compose ps

  log "Deploy finished successfully"
  log "Backup saved at: $BACKUP_DIR"
}

main "$@"
