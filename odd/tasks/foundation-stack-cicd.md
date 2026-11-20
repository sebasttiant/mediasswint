# Foundation: stack + CI/CD (then manuals)

Objective: Raise mediasswint to Node 26.13.1 LTS, latest Next/pnpm, Debian 13 Docker pins, and webnueva-class deploy/CI gates — quality elevation, not patch holes. Product manuals/UX (phase 2) after this lands.
Branch: `feat/foundation-stack-cicd`
Delivery: ask-on-risk
Test runner: `pnpm --filter @mediasswint/web test:unit` (+ typecheck/lint/build; integration when DB available)

## Specs

S1: Pin Node to `26.13.1` LTS across `.nvmrc`, root `engines.node`, Docker `NODE_IMAGE` (Debian 13 `trixie-slim` with digest), and CI `node-version-file`.
S2: Pin pnpm to latest stable (`12.21.0` at start) via `packageManager` + `engines.pnpm`; Corepack activates that exact version in Docker/CI.
S3: Upgrade Next.js and `eslint-config-next` to latest stable (`16.4.6` at start); keep React 19 line compatible; refresh lockfile with frozen installs succeeding.
S4: Docker remains Debian 13 (trixie) for the app image; multi-stage targets (`deps`, `migrator`, `bootstrapper`, `template-seeder`, `builder`, `dev`, `runner`) keep working after the Node bump.
S5: CI stays honest: PR + main validation (lint, typecheck, unit/render/mount, integration on disposable Postgres, build, docker runner build) on Node 26; prefer Corepack from `packageManager`; pin Node image digest for docker jobs when used.
S6: `deploy.sh` refuses to deploy unless GitHub CI for the exact SHA is green on `ci-main.yml` (or documented override `DEPLOY_SKIP_CI_CHECK` with 10+ char reason logged), adapted from webnueva `ci-status.sh` pattern — not a copy of Payload/Caddy specifics.
S7: Phase 2 (Everfit-style beautiful manuals + graphic UX) is explicitly out of scope for this feature document; tracked only as next step after foundation verifies.

## Tasks

- T1 [S1,S2,S4] — Toolchain pins Node 26.13.1 + pnpm 12.21.0 + Dockerfile digest — route: inline — status: done — commit: pending (uncommitted)
- T2 [S3] — Next 16.4.6 (+ eslint-config-next) and lockfile — route: inline — status: done — commit: pending
- T3 [S5] — Harden CI workflows for Node 26 / Corepack / digest alignment — route: inline — status: done — commit: pending
- T4 [S6] — deploy.sh CI-before-deploy gate + `scripts/ci-status.sh` — route: inline — status: done — commit: pending
- T5 [S1-S6] — Verify typecheck, unit tests, and docker runner build — route: inline — status: done — evidence below — commit: pending

## Log

L1: User: "arranquemos con el 1 y luego e l2 pero mejorar" — start foundation (Node 26.13.1, Next/pnpm latest, Debian 13 Docker, CI/CD like ILASESORIAS web), then product manuals/graphics, with quality elevation.
L2: 2026-11-20 — Verified nodejs.org LTS Lithium `v26.13.1`; npm latest next `16.4.6`, pnpm `12.21.0`; Docker Hub tag `26.13.1-trixie-slim` index digest `sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc`.
L3: 2026-11-20 — Implemented on `feat/foundation-stack-cicd`. Gotcha: Node 26 official slim no longer ships Corepack; Dockerfile installs `corepack@latest` via npm before `corepack prepare pnpm@12.21.0`. Verification: typecheck OK; unit 1042/1042 pass; `docker build --target runner` OK (Next 16.4.6). Next warns middleware → proxy deprecation (not in this feature scope). Host still Node 24.22.1 → engines warning until local nvm upgrade.
L4: 2026-11-20 — User: free-tier CI, clean push, clear vulns, bump Prisma + deps; always Gentle AI stack/harness. Prisma 7.10.1 (not 8 RC). redis 5.12.4. Audit moderate+ → 0 after overrides (effect pinned ^3.22.1 — 4.x breaks @prisma/config; minimatch 9/10 → 11.x for GHSA-g3hv-75wg-m249).
L5: 2026-11-20 — Ported webnueva CI excellence onto free Actions: audit-gate HIGH/CRITICAL + exceptions file, Trivy fs/config/bases + derived runner gate, digest-pinned postgres/redis/node, docker smoke (migrate+health), husky runs audit-gate. Kept required job display names.
