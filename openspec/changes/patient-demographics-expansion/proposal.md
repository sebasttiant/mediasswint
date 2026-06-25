# Proposal: Patient Demographics Expansion

## Intent

Apply four manager-requested edits to the patient demographic form so the business can record patients who do not fit the binary sex options, capture a home address, enter patient age directly instead of an exact birth date, and read a clean, predictable responsive form. All four edits touch the same `Patient` model and the same patient forms, so they ship as one change (one Prisma migration, one coordinated form refactor) to avoid repeated churn on the same files and a second migration.

The four decisions below are already made by the business owner; this proposal formalizes them, it does not reopen them.

## Scope

### In Scope

- **Sex third option "Otro"**: Add `OTHER` to the `PatientSex` enum (Prisma + migration), accept it in `parsePatientSex` (`apps/web/lib/patients-input.ts`), and add `{ value: "OTHER", label: "Otro" }` to `PATIENT_SEX_OPTIONS` (`apps/web/app/patients/[id]/patient-detail-helpers.ts`). The anatomical figure stays unchanged: `resolveBodyFigureSex` already maps any non-`MALE` value to the female silhouette, so `OTHER` falls back to the female figure with no diagram work.
- **Address field "Dirección"**: Add nullable free-text `address String?` to `Patient` (migration), thread it through the create/update input parsers and the patient API, and render an input labeled "Dirección" in both patient forms.
- **Age input "Edad", birthDate preserved**: Keep `birthDate DateTime?` as the stored source of truth. The UI exposes an "Edad" number field: on save, age is converted to an approximate `birthDate`; on display, age is computed from `birthDate`. No new stored age column.
- **Layout/responsive fix**: Reorganize field order and column spans in the demographic form so Teléfono/Email no longer look "descuadrado", while preserving the existing mobile-first responsive behavior and cleanly accommodating the new Dirección and Edad fields.
- Add focused unit tests (node:test, co-located in `apps/web/tests/`) for enum/parser changes, address parsing, and the age↔birthDate conversion helpers.

### Out of Scope

- Health entity / EPS dropdown — this is the separate future change **`patient-health-entity`**. Do not add an EPS field here. (See Follow-up.)
- Structured/multi-field address (street, city, postal code). A single free-text box matches the screenshot; structured address is over-engineering for now.
- Storing age as a column, or any backfill of `birthDate`/`address` for existing patients.
- New body figures or changes to sex-aware figure resolution beyond the existing `OTHER`→female fallback.
- Validating phone/email format or adding new business rules unrelated to the four edits.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-patients-demographics`: the patient demographic capture must support a third sex value, a free-text address, age-based entry over a preserved birth date, and a clean responsive layout, without regressing existing patients, the anatomical figure, or current validation.

## Approach

One Prisma migration extends the `PatientSex` enum with `OTHER` and adds nullable `address String?` to `Patient`. The input layer (`patients-input.ts`) accepts `OTHER` for sex, parses `address` as a nullable bounded string (reuse `parseNullableString`, `MAX_SHORT_TEXT`/dedicated max), and adds `address` to `EDITABLE_PATIENT_FIELDS` and `CreatePatientInput`.

Age is handled purely in the UI/helper layer — the model and parsers keep using `birthDate`:

- **Age → birthDate (on write):** `birthDate = (currentYear - age)-07-01` (fixed July 1 to minimize off-by-one across the year). The form sends this computed `YYYY-MM-DD` as `birthDate`; the existing `parseBirthDate` is unchanged.
- **birthDate → age (on display/edit load):** `age = floor((now - birthDate) / 365.25 days)`. Patients with an exact stored DOB display their correctly computed current age.
- **Edge case (explicit tradeoff):** if a patient already has an exact birth date and the user edits the Edad field and saves, the exact date is overwritten with the July-1 approximation. This is accepted: age is the primary entry the business wants, and an approximate DOB is acceptable for this use case. The proposal does not attempt to preserve the original exact DOB once age is edited. (Spec/design may optionally keep the date field visible read-or-editable as a refinement, but the primary UX is the Edad number field.)

Both forms get the field reorganization. The detail edit form (`patient-detail-client.tsx`) keeps the CSS-module grid (`.formGrid`, `auto-fit minmax(240px,1fr)`); the misalignment is fixed by ordering fields into a predictable sequence and applying column spans (e.g. Dirección and Notas as `fullWidthField`) rather than relying on `auto-fit` to guess. The create form (`patients-client.tsx`, Tailwind) gets the matching new fields and a consistent layout. Strict TDD: write helper tests first, then implement.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/prisma/schema.prisma` | Modified | Add `OTHER` to `PatientSex`; add `address String?` to `Patient`. |
| `apps/web/prisma/migrations/*` | New | One migration for enum value + new column (additive, nullable). |
| `apps/web/lib/patients-input.ts` | Modified | Accept `OTHER`; parse `address`; extend input type + editable fields. |
| `apps/web/lib/body-figure-sex.ts` | Reviewed | No change required; confirm `OTHER` resolves to female fallback. |
| `apps/web/lib/patient-age.ts` (or helpers) | New | `ageToBirthDate` / `birthDateToAge` pure helpers. |
| `apps/web/app/patients/[id]/patient-detail-helpers.ts` | Modified | Add `OTHER`/"Otro" option; map `address`/age into form state. |
| `apps/web/app/patients/[id]/patient-detail-client.tsx` | Modified | Add Dirección + Edad fields; reorder/span fields for clean layout. |
| `apps/web/app/patients/patients-client.tsx` | Modified | Mirror new fields in the create form. |
| `apps/web/app/patients/page.module.css` | Modified | Adjust spans/order; preserve responsive behavior. |
| `apps/web/app/api/patients/**` | Modified | Persist/return `address`; sex enum already passthrough. |
| `apps/web/tests/patients-*.test.ts` | New/Modified | Cover enum, address parsing, age conversion, edge case. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Age edit overwrites an exact stored DOB with an approximation | High (by design) | Documented as accepted tradeoff; July-1 anchor minimizes drift; spec may show DOB hint. |
| Enum migration needs care on Postgres (`ALTER TYPE ... ADD VALUE`) | Med | Use additive enum value; verify migration in docker before merge. |
| `OTHER` accidentally maps to no/blank figure | Low | Rely on existing `resolveBodyFigureSex` non-MALE→female fallback; add regression test. |
| Layout refactor regresses mobile responsiveness | Med | Keep mobile-first 1-col base; only add spans/order; visual check on mobile+desktop. |
| Two forms drift (create vs edit) | Med | Share option arrays/helpers; cover both with parser/helper tests. |
| Over 400 changed lines | Med | If exceeded, deliver as chained PRs (migration+input first, UI second). |

## Rollback Plan

Revert the UI/parser/helper changes to restore the prior form. The migration is additive and nullable: `OTHER` and `address` can remain harmlessly, or a follow-up down-migration can drop the column and (if no rows use it) the enum value. Existing patients are unaffected because all new fields are nullable and `birthDate` semantics are unchanged for untouched records.

## Dependencies

- Prisma migration tooling and docker DB for migration verification.
- Existing `resolveBodyFigureSex` non-MALE→female fallback.
- Existing manual-validation patterns in `patients-input.ts` (no Zod).

## Success Criteria

- [ ] User can select "Otro" as sex; patient saves and reloads; the anatomical figure renders (female fallback) without breaking.
- [ ] User can enter and persist a free-text "Dirección"; it reloads and displays in both forms.
- [ ] User enters "Edad"; an approximate `birthDate` is stored; reopening shows the computed age.
- [ ] Patients with an exact existing DOB show a correct computed age.
- [ ] The form is visually aligned and predictable on mobile (1 col) and desktop (multi-col); Teléfono/Email no longer look "descuadrado".
- [ ] EPS/health-entity is NOT added (deferred to `patient-health-entity`).
- [ ] 639+ tests stay green; typecheck and lint clean; TS strict, no `any`; conventional commits.
- [ ] Delivered as a single PR to main if under ~400 changed lines, else chained.

## Follow-up / Non-goals

- **`patient-health-entity`** (future change): add EPS / health-entity dropdown to the patient form. Explicitly excluded here to keep this change focused on the four approved edits.
