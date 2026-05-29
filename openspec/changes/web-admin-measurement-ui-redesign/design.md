# Design: Web Admin Measurement UI Redesign

## Technical Approach

Adopt the existing `AppShell` for navigational workspace routes (`/patients`, `/patients/[id]`, `/patients/[id]/measurements/[sessionId]`, `/admin`) while preserving `/patients/[id]/measurements/new` as the current full-screen capture flow. Keep data/auth/API contracts unchanged: server pages continue to use `cookies()`, `requireActiveUserFromRequest`, `resolvePatientDetailLoad`, patient/measurement repositories, and admin access guards. Refactor UI by small components and helper tests so each slice can stay below the 400-line review budget.

## Architecture Decisions

| Decision | Options | Choice / Rationale |
|---|---|---|
| Shell boundary | Wrap all measurement routes vs only read-only detail | Wrap patient/list/detail/admin/read-only measurement only. Capture stays full-screen because the spec requires focused clinical entry without admin distractions. |
| Patient split | Rewrite page vs extract from current client | Extract concern components from `patient-detail-client.tsx` incrementally. It preserves existing fetch/save behavior and reduces regression risk in a 759-line mixed component. |
| Styling | New design system vs existing tokens | Prefer `AppShell` Tailwind semantic tokens for new shell/layout; leave legacy `page.module.css` where it lowers diff size. Avoid new abstractions and broad restyles. |
| Tests | Snapshot UI tests vs helper/behavior tests | Extend Node tests around route helpers/navigation and small view-model helpers. Current test stack has no E2E, so unit-level regression coverage is the reliable gate. |

## Data Flow

    Server route auth/data load
      ├─ /patients → AppShell → PatientsClient
      ├─ /patients/[id] → patient + measurements + timeline + operations → AppShell → split detail sections
      ├─ /patients/[id]/measurements/[sessionId] → patient + measurement → AppShell → read-only measurement view
      └─ /admin → ADMIN guard → AppShell → admin destinations

Topbar search pushes `/patients?q=...`; `PatientsClient` should seed its query/load from URL search params when adopted into the shell.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/app/patients/page.tsx` | Modify | Wrap `PatientsClient` in `AppShell`, pass user label, preserve login redirect. |
| `apps/web/app/patients/patients-client.tsx` | Modify | Keep create/search workflows; initialize search from `q` param and fit shell content. |
| `apps/web/app/patients/[id]/page.tsx` | Modify | Wrap detail client in `AppShell` with patient context/actions after existing server data load. |
| `apps/web/app/patients/[id]/patient-detail-client.tsx` | Modify | Extract demographic, clinical timeline, commercial operations, and measurements sections/components without changing API calls. |
| `apps/web/app/patients/[id]/measurements/[sessionId]/page.tsx` | Modify | Replace legacy `<main>` header with `AppShell`; keep read-only table/body-highlight data flow. |
| `apps/web/app/admin/page.tsx` | Modify | Replace placeholder paragraph with actionable admin/operations/patient destinations; keep `resolveAdminAccess`. |
| `apps/web/app/patients/page.module.css` | Modify | Retain only shared legacy styles still needed after shell adoption. |
| `apps/web/tests/*.test.ts` | Modify/Create | Add regression tests for URL search seeding, admin destinations, section grouping, and shell route expectations. |

## Interfaces / Contracts

No database, Prisma, API, auth, or deployment contract changes. New component props should reuse existing exported types where possible: `PatientDetail`, `PatientMeasurementSummary`, `PatientTimelineItem`, and `OperationSummary`. If status constants are extracted, use `as const` runtime objects rather than direct union-only types.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Navigation active route, patient URL search seed, detail section grouping/view-models, admin destination definitions | `pnpm --filter @mediasswint/web test:unit` with Node `node:test` files under `apps/web/tests/`. |
| Integration | Auth/data route behavior remains unchanged for patient/detail/admin helpers | Extend existing route/helper tests where behavior is pure enough; avoid DB-dependent UI tests. |
| E2E | Not available | Manual verification for `/patients`, detail, measurement detail, capture boundary, and `/admin`. |

## Migration / Rollout

No migration required. Deliver as reviewable slices: (1) shell adoption + search seed, (2) patient detail component split, (3) admin landing, (4) later measurement capture polish from selected PR #56 ideas.

## Open Questions

- [ ] Which exact admin destinations should be primary beyond currently available `/operations` and `/patients`?
