# Contributing to mediasswint

This document is the single source of truth for the merge contract. Every PR
into `main` must clear the gates below — there are no exceptions, including
"trivial" docs-only changes (Docs PRs still need branch protection signoff;
this protects against accidental file mix-ups).

## Mandatory gates (enforced)

| Gate              | Local command                                         | CI job              |
| ----------------- | ----------------------------------------------------- | ------------------- |
| Security audit    | `pnpm audit --audit-level moderate`                   | `validate`          |
| Lint              | `pnpm lint`                                           | `validate`          |
| Type check        | `pnpm typecheck`                                      | `validate`          |
| Unit tests        | `pnpm --filter @mediasswint/web test:unit`            | `validate`          |
| Production build  | `pnpm build`                                          | `build`             |
| Docker image      | `docker build -f apps/web/Dockerfile --target runner .` (optional locally) | `docker-build` |
| Secrets scan      | n/a (CI-only)                                         | `gitleaks` (PR only) |
| Static analysis   | n/a (CI-only)                                         | `codeql` (code paths only) |

## Actions usage budget

This repo is public so GitHub-hosted runners are free with no minute cap.
Even so, workflows are scoped to avoid wasted runs:

- `paths` filters skip runs when only docs or unrelated files change.
- `concurrency` cancels superseded runs on rapid pushes.
- CodeQL has no cron; Dependabot handles the advisory side and triggers
  CodeQL via its own PRs.
- Gitleaks runs only on `pull_request`, not on every push.

Before adding a new workflow, ask: does an existing one already cover this?
If yes, extend it. Don't add another job.

If any gate fails, **fix the underlying issue**. Do not skip with
`--no-verify`, do not pin around the warning, do not mark a CVE as "accepted"
without a tracked follow-up issue.

## Local enforcement (husky pre-push)

A `pre-push` hook runs every gate before the push reaches the remote. It
catches what would otherwise burn a CI cycle.

After cloning, install hooks once:

```bash
pnpm install   # `prepare` script wires husky automatically
```

Verify by running `husky --version` or by attempting a push — the hook should
echo each step. If it doesn't, run `pnpm exec husky install`.

To bypass in an emergency: `git push --no-verify`. Tell the team in the PR
description if you do.

## Branch protection (required GitHub config)

This is configured **in GitHub Settings → Branches → Add rule**, by a repo
admin. The required-status-checks list **must include**:

- `Lint + Typecheck`
- `Build web`
- `Docker build (verify image builds)`
- `Analyze (javascript-typescript)` (CodeQL)
- `Scan commits for secrets` (Gitleaks)

Plus:

- ☑ Require branches to be up to date before merging
- ☑ Require status checks to pass before merging
- ☑ Require pull request reviews before merging (at least 1 approval; can be
  relaxed to "0 approvals" for solo dev, but the status checks remain
  required)
- ☑ Do not allow bypassing the above settings (even for admins, unless an
  emergency)

Without these, the workflows run but do not block merges — that is how PR #30
(commit `ed5f745`) reached main with a broken Docker build.

## Conventional commits

Format: `<type>(<scope>): <subject>`, no AI co-authoring.

Allowed types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`,
`ci`, `perf`, `revert`.

## PR size

Soft cap: ~400 changed lines per review. Larger work splits into stacked PRs
(see `wip/with-auth-wrapper-partial` history for an example of how this
played out before the cap was enforced).

## Dependencies

- Dependabot opens weekly grouped PRs for npm, github-actions, and docker.
- Security updates that are flagged by `pnpm audit` (level ≥ moderate) are
  treated as blocking — they must merge before any feature PR can leave the
  queue.
- Never add a dep without a real need; prefer stdlib (`node:crypto`,
  `node:test`, `AsyncLocalStorage`) before reaching for a package.
