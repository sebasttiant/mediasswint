# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------
# mediasswint - web (Next.js 16) - multi-stage
# Base: Debian 13 (trixie) slim + Node 26.13.1 LTS (Lithium)
# Index digest pins the multi-arch tag; BuildKit resolves the
# matching platform manifest (linux/amd64 or arm64).
# ------------------------------------------------------------

ARG NODE_IMAGE=node:26.13.1-trixie-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc
# PNPM_VERSION must match root package.json packageManager.
ARG PNPM_VERSION=12.21.0

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CI=1
WORKDIR /app
# Node 26+ official slim images no longer ship Corepack on PATH. Install it
# first, then activate the exact pnpm pinned by packageManager / PNPM_VERSION.
RUN npm install -g corepack@latest \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate

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
# devDependencies (tsx) y el código mínimo de auth. Se corre a demanda
# como tarea one-off (Coolify / docker run), NO forma parte del startup del stack.
# Requiere AUTH_USER, AUTH_PASSWORD y DATABASE_URL apuntando a la DB destino.
# Idempotente: bootstrapAuthUser hace upsert por email.
FROM deps AS bootstrapper
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY apps/web/lib ./apps/web/lib
COPY apps/web/scripts ./apps/web/scripts
WORKDIR /app/apps/web
CMD ["pnpm", "auth:bootstrap"]

# ---------- template-seeder (oneshot: seed measurement templates in DB) ----------
FROM deps AS template-seeder
COPY apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY apps/web/lib ./apps/web/lib
COPY apps/web/scripts ./apps/web/scripts
WORKDIR /app/apps/web
CMD ["pnpm", "templates:seed"]

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @mediasswint/web build

# ---------- dev (bind mount + hot reload) ----------
FROM base AS dev
# The dev compose bind-mounts only ../apps/web -> /app/apps/web, so the monorepo
# root (package.json + pnpm-workspace.yaml + lockfile) is NOT provided at runtime.
# Bake them into the image so `pnpm --filter` can resolve the workspace at /app;
# without this pnpm fails with "No package.json found in /app" and crash-loops.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# verify-deps-before-run=false: skip pnpm's pre-run dependency check. Deps are
# baked from the `deps` stage; the bind mount only swaps source, so re-verifying
# (and attempting an install) against the live tree at start-up is wasteful and
# can fail offline. Hot reload is handled by Next, not by reinstalling.
ENV NODE_ENV=development \
    PORT=3131 \
    HOSTNAME=0.0.0.0 \
    npm_config_verify_deps_before_run=false
EXPOSE 3131
CMD ["pnpm", "--filter", "@mediasswint/web", "dev"]

# ---------- runner (producción standalone, no-root) ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3131 \
    HOSTNAME=0.0.0.0

# Absorb Debian security uploads that the pinned Node digest may lag
# (zlib1g). CMD is `node apps/web/server.js`: npm and corepack are unused
# at runtime, so they leave with their nested HIGH advisories (brace-
# expansion, undici) — same hardening as ILASESORIAS webnueva.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      zlib1g \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && rm -rf /var/lib/apt/lists/*

# Dedicated non-root user (uid 10001). No CAP_SYS_ADMIN; app does not mount.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid app --home /app --shell /usr/sbin/nologin app

# Standalone output (includes Next-traced node_modules)
COPY --from=builder --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=builder --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=app:app /app/apps/web/public ./apps/web/public

# Prisma runtime support (pnpm + monorepo): keep client/engines present
COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=deps --chown=app:app /app/apps/web/node_modules ./apps/web/node_modules

USER app
EXPOSE 3131

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3131/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
