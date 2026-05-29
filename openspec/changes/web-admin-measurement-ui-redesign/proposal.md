# Proposal: Web Admin Measurement UI Redesign

## Intent

Improve commercial clinical usability across admin, patient, and measurement views with consistent navigation/workspaces while preserving focused measurement capture.

## Scope

### In Scope
- Bring `/patients`, `/patients/[id]`, and measurement detail into `AppShell`.
- Replace `/admin` placeholder with useful admin landing/navigation.
- Split patient detail into clinical, commercial, and measurement sections/components.
- Defer measurement capture polish to a separate slice, selectively reusing PR #56 ideas.

### Out of Scope
- Database, auth, Prisma schema, deployment, or API contract changes.
- Full dashboard/operations redesign in one PR.
- Merging PR #56 as-is; it is superseded as a standalone PR.

## Capabilities

### New Capabilities
- `web-admin-measurement-ui`: User-visible web/admin/patient/measurement workspace behavior, navigation consistency, and clinical/commercial usability expectations.

### Modified Capabilities
- None — no existing `openspec/specs/` capabilities are present.

## Approach

Use shell-first, PR-sized work units under the 400-line budget: AppShell adoption, patient detail split, admin landing, then measurement capture polish as a separate TDD slice.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/app/_components/app-shell/*` | Modified | Navigation, breadcrumbs, search. |
| `apps/web/app/admin/page.tsx` | Modified | Admin landing UI. |
| `apps/web/app/patients/page.tsx` | Modified | Shell-aligned patient route. |
| `apps/web/app/patients/patients-client.tsx` | Modified | Preserve create/search; seed URL search if included. |
| `apps/web/app/patients/[id]/patient-detail-client.tsx` | Modified | Split mixed workspace. |
| `apps/web/app/patients/page.module.css` | Modified | Reduce legacy styling where replaced. |
| `apps/web/app/patients/[id]/measurements/[sessionId]/page.tsx` | Modified | Read-only detail in shell. |
| `apps/web/app/patients/[id]/measurements/new/*` | Modified | Later capture polish; stay full-screen. |
| `apps/web/tests/*` | Modified/New | TDD regression coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Patient detail is mixed-concern | Med | Split by behavior with tests. |
| Diff exceeds 400 lines | High | Ask before chained PRs; slice by work unit. |
| Search URL behavior regresses | Med | Add tests before implementation. |
| Tailwind/CSS module inconsistency | Med | Prefer existing tokens; avoid broad restyles. |

## Rollback Plan

Revert each review slice independently: shell adoption, admin landing, patient split, and measurement polish remain separable.

## Dependencies

- Strict TDD for apply/verify.
- User approval before chained PR execution (`ask-always`).

## Success Criteria

- [ ] Patient list, detail, and measurement detail use consistent shell navigation.
- [ ] Admin route provides useful landing/navigation instead of placeholder text.
- [ ] Measurement capture remains focused full-screen and clinically safe.
- [ ] Tests cover changed navigation/workflow behavior before implementation.
- [ ] Plan respects ~400-line budget or asks before chaining.
