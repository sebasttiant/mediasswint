# Tasks: Measurement Module Garment Figure Selection

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520-760 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 catalog foundation → PR 2 persistence contract → PR 3 selector/reload/detail → PR 4 regression verification |
| Delivery strategy | auto-chain / force chained slices |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add catalog contract and tests | PR 1 | Base `main`; no UI/API changes. |
| 2 | Persist `metadata.garmentSnapshot` safely | PR 2 | Base `main` after PR 1; tests with code. |
| 3 | Replace capture input and render reload/detail fallback | PR 3 | Base `main` after PR 2; includes UI tests where seams exist. |
| 4 | Run focused regression and quality gates | PR 4 | Base `main` after PR 3; verification-only fixes only. |

## Phase 1: Catalog Foundation

- [x] 1.1 RED: Create `apps/web/tests/garment-catalog.test.ts` covering unique references, lookup by reference, snapshot creation, legacy display, and generic figure fallback.
- [x] 1.2 GREEN: Create `apps/web/lib/garment-catalog.ts` with 43 catalog entries, const-object figure keys, flat interfaces, and lookup/fallback helpers.
- [x] 1.3 Verify PR 1 with `pnpm --filter @mediasswint/web test:unit -- apps/web/tests/garment-catalog.test.ts` and `pnpm typecheck` if supported by scripts.

## Phase 2: Persistence Contract

- [x] 2.1 RED: Add focused parser/API tests in existing `apps/web/tests/measurement-*.test.ts` seams for create/update preserving `metadata.patientSex` and accepting `metadata.garmentSnapshot`.
- [x] 2.2 GREEN: Update `apps/web/lib/measurements-input.ts` to validate optional `garmentSnapshot` without schema migration or DB catalog assumptions.
- [x] 2.3 GREEN: Update `apps/web/app/api/patients/[id]/measurements/route.ts` and `[sessionId]/route.ts` to merge/forward parsed metadata on create and PATCH.
- [x] 2.4 Verify PR 2 with focused measurement tests and `pnpm --filter @mediasswint/web test:unit`.

## Phase 3: UI Selector, Reload, and Detail

- [x] 3.1 RED: Add or extend tests for curated option selection, draft reload from snapshot/reference, and legacy free-text display if current seams permit.
- [x] 3.2 GREEN: Update `apps/web/app/patients/[id]/measurements/new/new-measurement-client.tsx` to use a selector/combobox and submit catalog reference plus snapshot.
- [x] 3.3 GREEN: Update `apps/web/app/patients/[id]/measurements/[sessionId]/edit/page.tsx` to pass snapshot/reference/legacy values into reload state.
- [x] 3.4 GREEN: Update `apps/web/app/patients/[id]/measurements/[sessionId]/measurement-detail-body.tsx` to display snapshot label/reference, falling back to legacy `garmentType`.
- [x] 3.5 SAFE: Update `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` only for conservative figure hinting; do not rewrite `BodyHighlight`.

## Phase 4: Regression Verification

- [x] 4.1 Extend `apps/web/tests/body-figure-sex.test.ts` to prove garment hints do not override existing sex-aware diagram fallback.
- [x] 4.2 Verify spec scenarios: curated selection, no primary free text, draft reload, missing snapshot, legacy rendering, and bounded first-stage scope.
- [x] 4.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm --filter @mediasswint/web prisma:validate`, `pnpm --filter @mediasswint/web test:unit`, and `pnpm build`.
