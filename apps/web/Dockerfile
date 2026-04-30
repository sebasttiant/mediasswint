# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------
# mediasswint - web (Next.js 16.2.4) - multi-stage
# Base: Debian 13 (trixie) slim + Node 24.15.0 LTS
# ------------------------------------------------------------

ARG NODE_IMAGE=node:24.15.0-trixie-slim
ARG PNPM_VERSION=10.33.2

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# ---------- deps (cacheable) ----------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/prisma.config.ts ./apps/web/
COPY apps/web/prisma ./apps/web/prisma/
ENV DATABASE_URL=postgresql://mediass:mediass@postgres:5432/mediass
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- migrator (oneshot: apply pending migrations and exit) ----------
# Inherits deps so Prisma CLI, schema and migrations are already present.
# Used by the `migrate` compose service; web depends_on its successful exit.
FROM deps AS migrator
WORKDIR /app/apps/web
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema prisma/schema.prisma && touch /tmp/migrated.ok && tail -f /dev/null"]

# ---------- bootstrapper (oneshot: provisiona el usuario inicial) ----------
# Hereda de deps para evitar depender del build de Next. Tiene Prisma generado,
# devDependencies (tsx/dotenv) y el código mínimo de auth. Se corre a demanda
# como tarea one-off (Coolify / docker run), NO forma parte del startup del stack.
# Requiere AUTH_USER, AUTH_PASSWORD y DATABASE_URL apuntando a la DB destino.
# Idempotente: bootstrapAuthUser hace upsert por email.
FROM deps AS bootstrapper
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY apps/web/lib ./apps/web/lib
COPY apps/web/scripts ./apps/web/scripts
WORKDIR /app/apps/web
CMD ["pnpm", "auth:bootstrap"]

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @mediasswint/web build

# ---------- dev (bind mount + hot reload) ----------
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
ENV NODE_ENV=development \
    PORT=3131 \
    HOSTNAME=0.0.0.0
EXPOSE 3131
CMD ["pnpm", "--filter", "@mediasswint/web", "dev"]

# ---------- runner (producción standalone, no-root) ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3131 \
    HOSTNAME=0.0.0.0

# Usuario no-root dedicado
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app

# Copio el output standalone (incluye node_modules traced por Next)
COPY --from=builder --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=app:app /app/apps/web/public ./apps/web/public

# Prisma runtime support (pnpm + monorepo): asegura cliente/engines presentes
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=deps --chown=app:app /app/apps/web/node_modules ./apps/web/node_modules

USER app
EXPOSE 3131

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3131/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
