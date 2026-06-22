## Exploration: measurement-module-garment-figure-selection

### Current State
The measurement flow is patient-owned and template-driven. `/patients/[id]/measurements/new` loads the patient, creates a draft through `POST /api/patients/[id]/measurements`, snapshots the active `compression-v1` template, stores session context (`garmentType`, `compressionClass`, `diagnosis`, `notes`, `productFlags`, `metadata.patientSex`), then captures values through `PATCH /api/patients/[id]/measurements/[sessionId]` while the session is `DRAFT`.

The current persisted measurement template only covers 94 numeric compression fields: right/left legs points 1–28 and right/left arms points 1–19. `body-anatomy.ts` already models a broader PDF-derived anatomy/product catalog, but many fields are explicitly `pending` and are only rendered as local, non-persisted draft inputs in the measurement shell. Figures are sex-aware through patient sex snapshots in measurement metadata. Commercial operations are separate patient-owned records with free-text `garmentType`, optional `productCode`, `productType`, quantity, order/invoice metadata, and payment state; there is no normalized Product/Garment/Figure table and no relation between `MeasurementSession` and `CommercialOperation`.

### Affected Areas
- `apps/web/prisma/schema.prisma` — patient, measurement template/session/value, commercial operation, and payment models; currently no normalized garment/figure/product catalog or operation-measurement link.
- `apps/web/lib/compression-measurements.ts` — source of truth for persisted arm/leg measurement point keys and anatomy zone ids.
- `apps/web/lib/compression-template.ts` and `apps/web/lib/measurement-templates.ts` — build/sync the active `compression-v1` template; any persisted figure/garment-driven fields must preserve template snapshot compatibility.
- `apps/web/lib/body-anatomy.ts` — PDF-derived anatomy/product reference catalog with implemented vs pending field status; likely starting point for figure/garment selection rules.
- `apps/web/lib/body-figure-sex.ts` — normalizes patient sex and resolves male/female body figures; must remain snapshot-based to avoid past male/female regressions.
- `apps/web/lib/measurements.ts` and `apps/web/lib/measurements-input.ts` — measurement service/input contract for draft context, value persistence, completion, duplication, and reopening.
- `apps/web/app/api/patients/[id]/measurements/**` — HTTP layer for measurement creation/update; currently sends one default template code and no selected garment/figure ids.
- `apps/web/app/patients/[id]/measurements/new/new-measurement-client.tsx` — draft creation/context form currently accepts free-text garment type and creates the session before capture.
- `apps/web/app/patients/[id]/measurements/new/_components/measurement-shell.tsx` — renders the interactive body figure and pending head/hand product fields as local-only draft state.
- `apps/web/app/_components/body-highlight/**` — sex-aware body/head/hand figures and region hotspots; likely UI integration point for figure selection.
- `apps/web/app/patients/[id]/measurements/[sessionId]/measurement-detail-body.tsx` — read-only measurement summary; must display selected garment/figure context safely.
- `apps/web/lib/operations.ts`, `apps/web/lib/operation-metadata.ts`, and `apps/web/app/api/patients/[id]/operations/**` — commercial operation data, validations, and route contracts; garment/product are currently free-text metadata.
- `apps/web/app/patients/[id]/patient-detail-client.tsx` and `patient-detail-view.ts` — UI flow where operations and measurements coexist on the patient detail page but are not linked.
- `apps/web/tests/measurement-*.test.ts`, `apps/web/tests/body-figure-sex.test.ts`, `apps/web/tests/operations*.test.ts` — existing focused test seams for TDD coverage.

### Approaches
1. **Conservative selection snapshot** — Add selection data to measurement session metadata/productFlags and UI first, using the existing template and operation free-text fields.
   - Pros: Lowest schema risk; preserves completed measurement snapshots; can validate the business selection flow before normalizing catalogs; likely easiest to keep under small review slices.
   - Cons: Weak referential integrity; duplicated garment/product vocabulary; harder reporting; migration to normalized catalogs may still be needed.
   - Effort: Medium

2. **Normalized catalog with measurement-operation linking** — Introduce explicit garment/figure/product catalog models and link selected ids to measurement sessions and/or commercial operations.
   - Pros: Strong data model; better audit/reporting; enables controlled choices from client-provided references and business rules.
   - Cons: Higher migration risk; larger UI/API/test surface; requires careful legacy backfill for existing free-text measurements and operations.
   - Effort: High

3. **Hybrid phased path** — First define a stable selection contract and snapshot it on measurements, then introduce normalized catalogs behind that contract in later slices.
   - Pros: Protects current clinical flow while creating a path to durable catalogs; supports proposal-first validation with the client; reviewable under the 400-line budget by slicing contract, UI, persistence, and migration separately.
   - Cons: Requires discipline to avoid leaving temporary metadata as the permanent model; two-phase design must specify migration/compatibility from the start.
   - Effort: Medium/High

### Recommendation
Use the hybrid phased path. The next proposal should explicitly separate (1) selection vocabulary/rules from client references, (2) measurement-session snapshot behavior, (3) operation/product linkage, and (4) later normalization/migration. Do not start by changing the Prisma schema until the exact business terms for garments, figures, products, and references are approved; the current system already has delicate snapshot and sex-aware figure behavior that should not be destabilized blindly.

### Risks
- Selecting the wrong figure can corrupt clinical interpretation; patient sex snapshot behavior must be preserved and expanded only with tests.
- Current head/hand/product fields in `measurement-shell.tsx` are local-only draft state, so users may believe they saved selections that are not persisted.
- Existing `garmentType`, `productCode`, and `productType` are free text in both measurements and operations; uncontrolled choices can diverge from client-provided references.
- There is no relationship between a measurement session and a commercial operation, so garment/product context can drift between clinical capture and business/order tracking.
- Completed measurements rely on immutable `templateSnapshot`; changing active templates or field keys can break legacy rendering if compatibility is not designed.
- A normalized catalog/migration could exceed the 400-line review budget; implementation should be split into small TDD slices.
- Existing operations intentionally allow duplicate order numbers and nullable metadata; catalog constraints must not accidentally reject legacy/business data.

### Ready for Proposal
Yes — propose a cautious, proposal-first change that defines the selection contract, persistence strategy, and slice plan before implementation. The orchestrator should tell the user that the current system can support this, but the risky part is not UI alone: it is the data contract connecting patient sex, figure choice, garment/product reference, measurement snapshot, and commercial operation context.
