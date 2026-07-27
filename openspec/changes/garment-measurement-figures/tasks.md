# Tasks: Garment Measurement Figures — Audited Reconstruction

## Candidate and Delivery Contract

- Candidate lineage: `5c942e1` → activation-order reconstruction → `0fa66ad`.
- Current candidate: `0fa66ad723dbb1c101e50e70d6fc500839ebecb3`.
- Base: `847e90ecfad75bcb2e4df7156961ba7a9ffc661b^`.
- Strategy: feature-branch chain; every review diff MUST be at most 400 changed lines.
- Status: implementation corrections are complete; independent audit and visual QA are **NOT VERIFIED**.

## Completed Corrections

- [x] C1 Prove atomic save-and-complete against real PostgreSQL, including rollback and concurrent completion.
- [x] C2 Resolve malformed versus absent snapshot state before PATCH validation.
- [x] C3 Restrict integration databases to an explicit disposable-host allow-list.
- [x] C4 Build PostgreSQL 18 CI URLs at runtime without committed credentials.
- [x] C5 Reconstruct the chain so repaired work units typecheck with their relevant tests.
- [x] C6 Move MA/MMA activation after shell, finalization, snapshot, save, completion, and identity prerequisites; record the delivery-plan blocker for three oversized commits.
- [x] C7 Replace stale OpenSpec execution records with this final-candidate-only record.
- [x] C8 Name and validate the minimum compatible rollback point in `rollback-fix-forward.md`.
- [x] C9 Record observability, deploy health, and audit reconciliation as residual follow-up only.

## Remaining Verification

- [ ] Behaviorally split the three inherited oversized commits (`cca1828`, `88cf0f1`, `86a3283`) with their tests before creating any PR branches.
- [ ] Run exact-checkout typecheck plus focused work-unit tests for every final commit in a new sibling worktree.
- [ ] Run final-HEAD unit, render, PostgreSQL 18 `_probe` integration, Prisma validate/fresh migrate, typecheck, lint, build, scanner, and diff-check gates.
- [ ] Obtain an independent audit and visual QA. Do not represent either as verified until evidence is attached.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| C1–C5 | Completed before this continuation; preserved without reimplementation | Evidence retained in code history | Reconstruction completed |
| C6 | Existing activation test protects MA/MMA route behavior | Activation was reordered after the usable shell prerequisites | No behavioral source change |
| C7–C9 | Documentation correction; no production behavior | Artifacts updated | Terminology consolidated |
