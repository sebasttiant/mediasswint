# Security policy

mediasswint stores patient medical data (PHI under Argentine Ley 25.326 and
HIPAA-equivalent context). Security defects are treated as P0.

## Reporting a vulnerability

Email **sebastianrock1@gmail.com** with subject `mediasswint security`. Do
NOT open a public GitHub issue. Expect an acknowledgement within 48 hours.
Include:

- Affected version / commit SHA
- Reproduction steps or PoC
- Impact assessment (which data is at risk)

Do not test against the production VPS without prior written authorization.

## Supported versions

The branch `main` is the only supported version. Security patches are not
backported.

## Hardening commitments

The following protections must remain enabled at all times. Any PR that
weakens them must be rejected unless a follow-up PR re-establishes equivalent
protection in the same merge train.

### Authentication

- `AUTH_SECRET` is required at startup and must be ≥ 32 bytes of entropy
  (`getAuthSecret()` throws otherwise).
- Session tokens are HMAC-SHA256 signed via `crypto.subtle` (Edge-safe), 12h
  lifetime.
- Passwords hashed with argon2 (`@node-rs/argon2`), never plaintext or
  base64.
- Edge middleware verifies the cookie signature on every request before the
  Node runtime even loads.
- Active-user / role checks happen in `withAuth` / `withAdminAuth` wrappers
  (see `apps/web/lib/with-auth.ts`). Route handlers receive a typed
  `AuthUser` and cannot accidentally skip the check.

### Dependencies

- `pnpm audit --audit-level moderate` is a required CI gate and a pre-push
  hook (see `CONTRIBUTING.md`).
- Dependabot opens grouped weekly PRs (`.github/dependabot.yml`).
- Lockfile is committed and `--frozen-lockfile` is enforced in CI.

### Static analysis

- CodeQL (`security-and-quality` query pack) runs on every PR + weekly cron.
- Gitleaks scans every push and PR for committed secrets.

### Runtime

- Postgres credentials never live in code; they come from environment vars
  enforced by `docker-compose.yml` (`${POSTGRES_PASSWORD:?...}`).
- `.env*` files are gitignored. If a secret leaks into a commit, it must be
  rotated immediately (committed = compromised), not just rewritten in git
  history.
- The bootstrap user (`AUTH_USER`, `AUTH_PASSWORD`) is created once at first
  boot and must be rotated before going live.

### Operational

- Branch protection on `main` is required (see CONTRIBUTING.md). Without it
  the workflows run but do not block merges.
- AuditLog (Etapa 2 PR 3/4, in progress) captures every mutation on
  patient-related models with the user id of the actor.

## Out of scope

- DoS / rate-limiting at the application layer (currently relies on Coolify /
  reverse proxy upstream).
- Multi-tenant isolation (single-tenant app today).
