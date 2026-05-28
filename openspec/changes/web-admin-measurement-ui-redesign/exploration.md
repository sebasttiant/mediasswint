## Exploration: web/admin/measurement UI redesign for commercial clinical usability

### Current State
- Dashboard `/` uses `AppShell`, KPIs, quick actions, pending work, recent measurements/patients/operations.
- Admin `/admin` only checks ADMIN access and renders placeholder text inside `AppShell`.
- Operations `/operations` uses `AppShell` and shows operational queues.
- Patients `/patients` and patient detail `/patients/[id]` do **not** use `AppShell`; they use CSS module layout directly.
- Patient detail combines demographics, clinical timeline, commercial operations, and measurements in one large client component.
- Measurement creation is a separate full-screen clinical capture flow with context form, body map, limb strips, mobile tabs, and progress footer.
- Measurement detail is read-only and also uses patient CSS module rather than `AppShell`.

### Affected Areas
- `apps/web/app/_components/app-shell/*` — navigation, topbar, breadcrumbs, command palette.
- `apps/web/app/page.tsx` — dashboard structure and quick actions.
- `apps/web/app/admin/page.tsx` — admin placeholder.
- `apps/web/app/patients/page.tsx` — patient list auth wrapper.
- `apps/web/app/patients/patients-client.tsx` — create/search patient flow.
- `apps/web/app/patients/[id]/patient-detail-client.tsx` — mixed clinical/commercial patient workspace.
- `apps/web/app/patients/page.module.css` — legacy/shared patient styles.
- `apps/web/app/patients/[id]/measurements/new/new-measurement-client.tsx` — measurement session lifecycle.
- `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` — capture workspace.
- `apps/web/app/patients/[id]/measurements/[sessionId]/page.tsx` — measurement detail view.
- `apps/web/tests/app-shell-navigation.test.ts` and measurement/patient tests — regression coverage.

### Approaches
1. **Shell-first commercial redesign**
   - Bring patients/detail/measurement detail into consistent `AppShell`; preserve measurement capture as focused full-screen clinical mode.
   - Pros: strongest usability/navigation improvement; reviewable slices.
   - Cons: needs careful patient CSS/module cleanup.
   - Effort: Medium.

2. **Measurement-only polish**
   - Continue PR #56-style refinements only inside measurement strip/capture components.
   - Pros: smallest scope; reuses existing PR.
   - Cons: does not fix admin/patient commercial usability gaps.
   - Effort: Low.

3. **Full redesign in one PR**
   - Redesign dashboard, admin, patients, detail, operations, and measurement capture together.
   - Pros: cohesive final UX.
   - Cons: violates 400-line review guard; high regression risk.
   - Effort: High.

### Recommendation
Use **Shell-first commercial redesign** sliced into PR-sized work units:

1. Adopt `AppShell` for `/patients`, `/patients/[id]`, and measurement detail; keep capture full-screen.
2. Split patient detail into clearer clinical/commercial/measurement sections or small components.
3. Upgrade admin from placeholder to useful admin landing/navigation.
4. Apply measurement capture polish as a later slice, reusing PR #56 ideas selectively.

PR #56 should be **superseded as a standalone PR**, not merged as-is before SDD. Reuse its card/dot/strip concepts in the measurement slice if the proposal keeps that direction.

### Risks
- Existing patient detail component is large and mixes concerns.
- Topbar search pushes `/patients?q=...`, but current patient list client does not appear to seed search from URL params.
- Some styles use CSS modules with hex/custom values while newer dashboard uses Tailwind tokens.
- No E2E coverage detected; clinical usability changes need strong unit/helper tests plus manual verification.

### Ready for Proposal
Yes. Proceed to `sdd-propose` with a chained/sliced redesign plan under the 400-line review budget.
