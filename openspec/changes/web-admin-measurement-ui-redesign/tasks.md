# Tasks: Web Admin Measurement UI Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650-900 across UI + tests |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 shell/search → PR 2 patient detail split → PR 3 admin/read-only measurement → PR 4 capture polish only if approved |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shell-adopt `/patients` and seed search from `q` | PR 1 | TDD in `patients-client-navigation.test.ts` + shell tests. |
| 2 | Split patient detail sections under shell | PR 2 | Depends on PR 1; tests with helper/view-model assertions. |
| 3 | Add admin landing and shell read-only measurement detail | PR 3 | Depends on PR 1; auth/data contracts unchanged. |
| 4 | Optional capture polish from selected PR #56 ideas | PR 4 | Only after explicit task; capture remains full-screen. |

## Phase 1: RED Tests

- [x] 1.1 Extend `apps/web/tests/patients-client-navigation.test.ts` for `/patients?q=...` search seeding and preserved create/search actions.
- [x] 1.2 Extend `apps/web/tests/app-shell-navigation.test.ts` for `/patients`, `/patients/[id]`, `/patients/[id]/measurements/[sessionId]`, and `/admin` context labels.
- [x] 1.3 Extend `apps/web/tests/patients-detail-page.test.ts` for clinical, commercial/operations, and measurements section grouping plus empty measurement state.
- [x] 1.4 Extend `apps/web/tests/admin-page-auth.test.ts` for actionable `/admin` destinations while preserving non-admin protection.
- [x] 1.5 Extend `apps/web/tests/measurements-ui.test.ts` or `measurements-route.test.ts` for read-only measurement detail navigation and focused capture boundary.

## Phase 2: PR 1 Shell/Search GREEN

- [x] 2.1 Modify `apps/web/app/patients/page.tsx` to wrap `PatientsClient` in `AppShell` without changing auth redirect behavior.
- [x] 2.2 Modify `apps/web/app/patients/patients-client.tsx` to initialize search from URL `q` and retain create/search workflows.
- [x] 2.3 Trim only obsolete shell-replaced styles in `apps/web/app/patients/page.module.css`; run `pnpm --filter @mediasswint/web test:unit`.

## Phase 3: PR 2 Patient Detail GREEN

- [x] 3.1 Modify `apps/web/app/patients/[id]/page.tsx` to render existing loaded data inside `AppShell` with patient context/actions.
- [x] 3.2 Extract section helpers/components from `apps/web/app/patients/[id]/patient-detail-client.tsx` for demographics, clinical timeline, commercial operations, and measurements.
- [x] 3.3 Keep API calls and existing types in `patient-detail-client.tsx` unchanged; run unit tests plus `pnpm typecheck`.

## Phase 4: PR 3 Admin + Measurement Detail GREEN

- [x] 4.1 Modify `apps/web/app/admin/page.tsx` to keep `resolveAdminAccess` and show actionable `/operations` and `/patients` destinations.
- [x] 4.2 Modify `apps/web/app/patients/[id]/measurements/[sessionId]/page.tsx` to use `AppShell` around read-only measurement data.
- [x] 4.3 Verify `/patients/[id]/measurements/new/page.tsx` stays full-screen; run unit tests, `pnpm lint`, and `pnpm typecheck`.

## Phase 5: REFACTOR / Verify

- [ ] 5.1 Remove duplicated section/view-model code without introducing new broad abstractions or `useMemo`/`useCallback`.
- [ ] 5.2 Run final gates: `pnpm --filter @mediasswint/web test:unit`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
