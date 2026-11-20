#!/usr/bin/env bash
#
# Smoke CI-built runner (+ one-shot migrate) against disposable Postgres/Redis
# on the GitHub Actions host network. Never pushes images.
#
# Pattern adapted from ILASESORIAS webnueva ci-container-smoke.sh.
#
# Required env:
#   DATABASE_URL   postgres URL reachable via --network host
#   REDIS_URL      redis URL reachable via --network host
#   AUTH_SECRET    >= 32 bytes
#   RUNNER_IMAGE   local tag of the runner target
# Optional:
#   MIGRATE_IMAGE  local tag of the migrator target (preferred)
#   SMOKE_PORT     default 3131
set -euo pipefail

RUNNER_IMAGE="${RUNNER_IMAGE:?RUNNER_IMAGE is required}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
REDIS_URL="${REDIS_URL:?REDIS_URL is required}"
AUTH_SECRET="${AUTH_SECRET:?AUTH_SECRET is required}"
SMOKE_PORT="${SMOKE_PORT:-3131}"
NAME="${SMOKE_RUNNER_CONTAINER:-mediasswint-ci-runner}"
HEALTH_URL="http://127.0.0.1:${SMOKE_PORT}/api/health"

fail() { printf 'smoke: ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf 'smoke: %s %s\n' "$(date -u +%FT%TZ)" "$*" >&2; }

[[ "${#AUTH_SECRET}" -ge 32 ]] || fail "AUTH_SECRET must be >= 32 characters"

cleanup() {
  docker rm -f "${NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if [ -n "${MIGRATE_IMAGE:-}" ]; then
  log "apply migrations with ${MIGRATE_IMAGE} (one-shot; override long-running CMD)"
  docker run --rm --network host \
    -e DATABASE_URL \
    --entrypoint sh \
    "${MIGRATE_IMAGE}" \
    -c 'pnpm exec prisma migrate deploy --schema prisma/schema.prisma'
else
  log "MIGRATE_IMAGE unset; assuming schema already applied"
fi

docker rm -f "${NAME}" >/dev/null 2>&1 || true
log "start ${RUNNER_IMAGE} as ${NAME}"
docker run -d --name "${NAME}" --network host \
  -e NODE_ENV=production \
  -e DATABASE_URL \
  -e REDIS_URL \
  -e AUTH_SECRET \
  -e PORT="${SMOKE_PORT}" \
  -e HOSTNAME=127.0.0.1 \
  "${RUNNER_IMAGE}" >/dev/null

ok=0
for _ in $(seq 1 40); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
[ "${ok}" = 1 ] || {
  docker logs "${NAME}" 2>&1 | tail -80 || true
  fail "health endpoint never became ready: ${HEALTH_URL}"
}

payload="$(curl -fsS "${HEALTH_URL}")"
printf '%s\n' "${payload}" | grep -q '"ok":true' || fail "health payload missing app ok: ${payload}"
log "smoke passed: ${HEALTH_URL}"
printf '%s\n' "${payload}"
