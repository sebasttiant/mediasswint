# Tasks: Patient Demographics Expansion

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~370 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (WU1/WU2 split available as fallback if implementation overruns 400 lines) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed unless line count overruns) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units (fallback chain boundary if overrun)

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migration + schema + parsers + persistence + pure age helpers + all tests | PR 1 | Base `main`; self-contained, green on its own. |
| 2 | Both forms (UI) + form-state helpers + CSS layout | PR 2 | Base `main` after PR 1; depends on WU1 parser/helper contracts. |

---

## Phase 1: Foundation — Migration, Schema, Parser (WU1)

### 1.1 — Pre-migration safety (do BEFORE generating migration)

- [x] 1.1.1 Take a logical backup of the non-disposable DB: `pg_dump -Fc "$DATABASE_URL" -f patient-demographics-pre-migration.dump`
- [x] 1.1.2 Confirm the docker dev DB is running and accessible for migration dry-run.

### 1.2 — Prisma schema changes

- [x] 1.2.1 In `apps/web/prisma/schema.prisma` (~line 64-67): add `OTHER` to the `PatientSex` enum — enum now has `FEMALE`, `MALE`, `OTHER`.
- [x] 1.2.2 In `apps/web/prisma/schema.prisma` (~line 75-77): add `address String?` to the `Patient` model, after `email`.

### 1.3 — Generate and inspect migration

- [x] 1.3.1 Run `pnpm --filter web prisma migrate dev --name patient_demographics_expansion` against the docker dev DB.
  - NOTE: DB was not accessible; migration was HAND-WRITTEN per fallback instructions.
- [x] 1.3.2 Open the generated `apps/web/prisma/migrations/<ts>_patient_demographics_expansion/migration.sql` and verify it contains exactly: `ALTER TYPE "PatientSex" ADD VALUE 'OTHER';` and `ALTER TABLE "Patient" ADD COLUMN "address" TEXT;` — no `DROP`, no `DEFAULT`, no `NOT NULL`.
- [x] 1.3.3 If Postgres reports `ALTER TYPE ... ADD VALUE` cannot run inside a transaction, split migration: apply enum value in its own standalone migration first, then re-run for the column. Verify in docker before proceeding.

### 1.4 — RED: Tests for `patient-age.ts` helpers

- [x] 1.4.1 Create `apps/web/tests/patient-age.test.ts` with failing tests (no implementation yet).
- [x] 1.4.2 Run — confirm all tests FAIL (RED). ✓

### 1.5 — GREEN: Create `apps/web/lib/patient-age.ts`

- [x] 1.5.1 Implement `computeAge(birthDate: Date, now?: Date): number`.
- [x] 1.5.2 Implement `ageToApproxBirthDate(age: number, now?: Date): Date`.
- [x] 1.5.3 Implement `formatISODate(date: Date): string`.
- [x] 1.5.4 Run — confirm all tests PASS (GREEN). ✓

### 1.6 — RED: Tests for `patients-input.ts` additions

- [x] 1.6.1 In `apps/web/tests/patients-input.test.ts`, add failing tests.
- [x] 1.6.2 Add regression test in `apps/web/tests/body-figure-sex.test.ts`: `resolveBodyFigureSex("OTHER")` → `"female"`.
- [x] 1.6.3 Run — confirm new tests FAIL (RED). ✓

### 1.7 — GREEN: Update `apps/web/lib/patients-input.ts`

- [x] 1.7.1 Add `OTHER: "OTHER"` to the `PATIENT_SEX` const object.
- [x] 1.7.2 Add `"OTHER"` to the `parsePatientSex` accept-list and update validation error message.
- [x] 1.7.3 Add `address: string | null` to `CreatePatientInput` type.
- [x] 1.7.4 Add `"address"` to `EDITABLE_PATIENT_FIELDS` array.
- [x] 1.7.5 Parse `address` via `parseNullableString(..., 160, ...)`.
- [x] 1.7.6 Run — confirm all new + existing tests PASS. ✓

### 1.8 — GREEN: Update `apps/web/lib/patients.ts`

- [x] 1.8.1 Add `address: input.address` to the `prisma.patient.create` data object.
- [x] 1.8.2 Add `address: input.address` to the `prisma.patient.update` data object.

### 1.9 — WU1 verification gate

- [x] 1.9.1 Run `pnpm --filter @mediasswint/web test:unit` — 671 tests GREEN (was 639).
- [x] 1.9.2 Run `pnpm typecheck` — zero TypeScript errors.
- [x] 1.9.3 Run `pnpm lint` — zero lint errors.

---

## Phase 2: UI — Edit Form, Create Form, and CSS Layout (WU2)

### 2.1 — RED: Behavioral test for age/DOB disambiguation (helper-level)

- [x] 2.1.1 Created `apps/web/tests/patient-detail-helpers.test.ts` with disambiguation assertions.
- [x] 2.1.2 Run the test — confirm FAIL (RED). ✓

### 2.2 — GREEN: Update `apps/web/app/patients/[id]/patient-detail-helpers.ts`

- [x] 2.2.1 Add `{ value: "OTHER", label: "Otro" }` to `PATIENT_SEX_OPTIONS`.
- [x] 2.2.2 Extend `PatientDetail` type with `address: string | null`.
- [x] 2.2.3 Extend `PatientFormState` with `address: string`, `ageInput: string`, `ageTouched: boolean`.
- [x] 2.2.4 Update `patientToFormState` to map `address` and derive initial `ageInput` from `birthDate` via `computeAge`.
- [x] 2.2.5 Run disambiguation test — confirm PASS (GREEN). ✓

### 2.3 — GREEN: Update `apps/web/app/patients/[id]/patient-detail-client.tsx`

- [x] 2.3.1 Add submit disambiguation: strips `ageInput`/`ageTouched`, computes outgoing `birthDate`. PATCH body never contains `age` key.
- [x] 2.3.2 Add "Dirección" text input bound to `form.address` with full-width span.
- [x] 2.3.3 "Fecha de nacimiento" remains editable date input.
- [x] 2.3.4 Add "Edad" field: read-only when `form.birthDate` non-empty; editable when absent.
- [x] 2.3.5 Reorder fields: Nombre (full), Sexo|Tipo doc, Num doc|Fecha nac, Edad|Teléfono, Email, Dirección (full), Notas (full).

### 2.4 — GREEN: Update `apps/web/app/patients/patients-client.tsx`

- [x] 2.4.1 Add `address`, `ageInput`, `ageTouched` to `FormState` and `INITIAL_FORM_STATE`.
- [x] 2.4.2 Add submit disambiguation (exact date takes precedence; never send raw `age`).
- [x] 2.4.3 Add Dirección and Edad fields; reorder using `grid grid-cols-1 gap-5 sm:grid-cols-2` pairs.

### 2.5 — GREEN: Update `apps/web/app/patients/page.module.css`

- [x] 2.5.1 `.fullWidthField` already existed — confirmed and used in edit form.
- [x] 2.5.2 `.formGrid` uses `repeat(auto-fit, minmax(240px, 1fr))` — confirmed, no change needed.
- [x] 2.5.3 Applied `fullWidthField` to Nombre (NEW), Dirección (NEW), and Notas in edit form JSX.

### 2.6 — WU2 verification gate

- [x] 2.6.1 Run `pnpm --filter @mediasswint/web test:unit` — 681 tests GREEN (was 671 after WU1).
- [x] 2.6.2 Run `pnpm typecheck` — zero TypeScript errors.
- [x] 2.6.3 Run `pnpm lint` — zero errors (11 pre-existing warnings only).
- [ ] 2.6.4 Manual layout check: open the create and edit patient forms on a narrow viewport (< 640 px) and confirm single-column stack; on desktop confirm two-column pairs with Teléfono/Email aligned and Dirección/Notas spanning the full row.
- [ ] 2.6.5 Manual smoke test: create a patient with age-only entry → reload → confirm computed age matches; create with exact DOB → confirm DOB stored verbatim; edit an exact-DOB patient → change only Dirección → confirm `birthDate` unchanged after save.

---

## Phase 3: Final Quality Gates

- [x] 3.1 Run `pnpm --filter @mediasswint/web test:unit` — 681 tests GREEN.
- [x] 3.2 Run `pnpm typecheck` — zero errors.
- [x] 3.3 Run `pnpm lint` — zero errors (11 pre-existing warnings only).
- [ ] 3.4 Run `pnpm build` — build succeeds with no errors.
- [ ] 3.5 Verify spec scenarios explicitly (manual):
  - "Otro" selectable in both forms and persisted as `sex = OTHER`.
  - `OTHER` patient shows female anatomical figure (covered by body-figure-sex regression test).
  - Edit form with exact DOB: "Edad" is read-only; saving other fields does not alter `birthDate`.
  - Create form: age-only entry stores July 1 of `currentYear - age`; DOB entry stores verbatim.
  - Address trimmed, nullable, max-length enforced.
  - All forms render single-column on narrow viewports; Dirección/Notas always full-width.
