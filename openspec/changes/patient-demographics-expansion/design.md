# Design: Patient Demographics Expansion

## Technical Approach

Extend the existing `Patient` model and its two demographic forms with one additive Prisma migration and a thin, additive change to the manual validation layer (`patients-input.ts`). Sex gains a third value `OTHER`; a nullable free-text `address` is added; age is handled entirely in the UI/helper layer over the preserved `birthDate DateTime?` column via a new pure helper module (`patient-age.ts`); and both forms are reorganized for a clean, mobile-first layout. No existing column is dropped, no backfill runs, and the anatomical figure pipeline is untouched because `resolveBodyFigureSex` already maps any non-`MALE` value to the female silhouette.

The API routes (`app/api/patients/route.ts`, `app/api/patients/[id]/route.ts`) are pure passthrough (`parser → service`) and require **no change**: once `address` is parsed into `CreatePatientInput` and persisted by `patients.ts`, it flows through automatically. The only contract subtlety is that the edit form's PATCH uses `parseUpdatePatientInput` with `rejectUnknownFields: true`, so `address` MUST be registered in `EDITABLE_PATIENT_FIELDS`, and the client MUST convert age to a `birthDate` string before submit — a raw `age` key in the PATCH body would be rejected with `"is not allowed"`.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Single additive Prisma migration (enum `OTHER` + `address String?`) | Two migrations; new structured-address table | One coordinated change on the same model avoids repeated churn and a second migration. Both edits are additive and nullable, so the migration is safe and reversible. |
| Age lives only in UI + a pure `lib/patient-age.ts`; `birthDate` stays the sole stored field | New `age Int?` column; store both | Avoids a redundant denormalized column that can drift from `birthDate`. The business wants age *entry*; an approximate DOB is an acceptable storage representation. Keeps parsers and schema minimal. |
| `ageToApproxBirthDate(age)` anchors to **July 1** of `currentYear - age` | Jan 1; today's month/day; midyear by exact months | July 1 minimizes worst-case age drift across the calendar year to ±6 months and is deterministic/testable. |
| Client converts age → `birthDate` string **before** submit; never sends an `age` key | Add `age` to the API contract and parse server-side | The PATCH path rejects unknown fields. Keeping age UI-only means `parseBirthDate` and the API contract are unchanged (additive, zero risk to existing callers). |
| Never overwrite an exact `birthDate` with an approximation **unless** the user actively edits the Edad field | Always recompute birthDate from age | Honors the user-refined rule: an exact stored DOB must be preserved on save unless age is the field the user deliberately changed. The form tracks which field the user touched. |
| `OTHER` reuses the existing non-`MALE` → female figure fallback; add a regression test | New "other" silhouette asset | No diagram work is in scope; `resolveBodyFigureSex` already returns female for any non-`MALE` value. A regression test locks this in. |
| Edit form keeps CSS-module `.formGrid`; create form keeps Tailwind grid | Unify both forms into one shared component | Out of scope and risky. Each form keeps its existing styling system; alignment is fixed by explicit field order + column spans, not by a rewrite. |

## Data Flow

```text
CREATE form (patients-client.tsx, Tailwind)
  user picks exact DOB  OR  types Edad
    -> if Edad touched: birthDate = ageToApproxBirthDate(age) -> "YYYY-MM-DD"
    -> if DOB present and Edad untouched: send DOB as-is
  -> JSON.stringify(form) (address included; NO raw age key)
  -> POST /api/patients
  -> parseCreatePatientInput (rejectUnknownFields: false)
       parsePatientSex accepts OTHER; parseAddress; parseBirthDate unchanged
  -> createPatient -> prisma.patient.create({ ..., address })

EDIT form (patient-detail-client.tsx, CSS module)
  load: patientToFormState maps address; birthDate -> computeAge for read-only "Edad"
  user edits DOB (editable) and/or Edad
    -> if Edad touched: birthDate = ageToApproxBirthDate(age)
    -> else: keep exact birthDate untouched
  -> JSON.stringify(form) (address included; NO raw age key)
  -> PATCH /api/patients/[id]
  -> parseUpdatePatientInput (rejectUnknownFields: true)
       address MUST be in EDITABLE_PATIENT_FIELDS
  -> updatePatient -> prisma.patient.update({ ..., address })

FIGURE (unchanged)
  sex OTHER -> resolveBodyFigureSex -> non-MALE -> female silhouette
```

### "Age vs date" disambiguation contract

The client distinguishes intent with a UI-only flag — the server never sees `age`:

- The form state holds `birthDate: string` (the only persisted demographic date) plus a transient `ageInput: string` and an `ageTouched: boolean`.
- On submit, the client computes the outgoing `birthDate`:
  - `ageTouched === true` and `ageInput` is a valid age → `birthDate = formatISODate(ageToApproxBirthDate(Number(ageInput)))`.
  - otherwise → send `form.birthDate` verbatim (exact DOB preserved; empty stays empty).
- The PATCH/POST body therefore always carries `birthDate` (or empty) and **never** an `age` key, so `parseBirthDate` and `rejectUnknownFields` are unaffected.

This is the mechanism that guarantees an exact stored DOB is never clobbered unless the user deliberately edits Edad.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/web/prisma/schema.prisma` | Modify | `enum PatientSex { FEMALE; MALE; OTHER }` (line ~64-67); add `address String?` to `Patient` (after `email`, ~line 77). |
| `apps/web/prisma/migrations/<ts>_patient_demographics_expansion/migration.sql` | Create | `ALTER TYPE "PatientSex" ADD VALUE 'OTHER';` + `ALTER TABLE "Patient" ADD COLUMN "address" TEXT;` (additive, nullable). |
| `apps/web/lib/patients-input.ts` | Modify | Add `OTHER` to `PATIENT_SEX` const + `parsePatientSex` accept-list + message (lines 8-11, 56-69); add `address: string \| null` to `CreatePatientInput` (line 15-24); add `"address"` to `EDITABLE_PATIENT_FIELDS` (line 38-47); parse `address` via `parseNullableString(..., MAX_SHORT_TEXT or MAX_ADDRESS=160, ...)` in `parsePatientFormInput` (line 167-183) and include in returned value (line 189-201). |
| `apps/web/lib/patients.ts` | Modify | Add `address: input.address` to `create` data (line ~48) and `update` data (line ~99). |
| `apps/web/lib/patient-age.ts` | Create | Pure helpers `computeAge(birthDate, now?)`, `ageToApproxBirthDate(age, now?)`, `formatISODate(date)`. No I/O, no React. |
| `apps/web/lib/body-figure-sex.ts` | Reviewed | No change. `OTHER` is non-`MALE` → female; covered by a new regression test only. |
| `apps/web/app/patients/[id]/patient-detail-helpers.ts` | Modify | Add `{ value: "OTHER", label: "Otro" }` to `PATIENT_SEX_OPTIONS` (line 100-103); add `address: string` and `ageInput`/`ageTouched` to `PatientFormState` (line 54-63) and `PatientDetail` `address: string \| null` (line 1-13); map `address` and derive initial `ageInput` from `birthDate` in `patientToFormState` (line 105-118). |
| `apps/web/app/patients/[id]/patient-detail-client.tsx` | Modify | Add Dirección input and Edad number field (read-only when DOB present, editable when absent); set `ageTouched` on Edad change; reorder/span fields (lines 374-449). Submit logic computes outgoing `birthDate` per the disambiguation contract before `JSON.stringify(form)` (line ~187). |
| `apps/web/app/patients/patients-client.tsx` | Modify | Mirror Dirección + Edad fields in `FormState`/`INITIAL_FORM_STATE` (lines 21-41); render in the Tailwind grid (lines 284-361); compute outgoing `birthDate` before submit (line ~128). |
| `apps/web/app/patients/page.module.css` | Modify | Add explicit ordering/span classes for the edit `.formGrid` (lines 320-352); keep `auto-fit minmax(240px,1fr)` base; `address` + `notes` as `fullWidthField`. |
| `apps/web/tests/patient-age.test.ts` | Create | Unit tests for `computeAge`, `ageToApproxBirthDate`, `formatISODate` (RED first). |
| `apps/web/tests/patients-input.test.ts` | Create/Modify | `OTHER` accepted; `address` parsed/bounded/nullable; `address` allowed under `rejectUnknownFields`; existing birthDate parsing unchanged. |
| `apps/web/tests/body-figure-sex.test.ts` | Modify | Regression: `resolveBodyFigureSex("OTHER")` → female. |

## Interfaces / Contracts

```ts
// apps/web/lib/patient-age.ts  (pure, unit-testable, strict-TDD targets)

/** Whole-years age from an exact birth date. floor((now - birthDate)/year). */
export function computeAge(birthDate: Date, now?: Date): number;

/** Approximate DOB for an entered age: July 1 of (currentYear - age). */
export function ageToApproxBirthDate(age: number, now?: Date): Date;

/** UTC YYYY-MM-DD for <input type="date"> and the birthDate wire field. */
export function formatISODate(date: Date): string;
```

```ts
// apps/web/lib/patients-input.ts  (additive)
export const PATIENT_SEX = { FEMALE: "FEMALE", MALE: "MALE", OTHER: "OTHER" } as const;

export type CreatePatientInput = {
  fullName: string;
  sex: PatientSex | null;        // now FEMALE | MALE | OTHER
  documentType: string | null;
  documentNumber: string | null;
  birthDate: Date | null;        // parser unchanged
  address: string | null;        // NEW, nullable, bounded
  phone: string | null;
  email: string | null;
  notes: string | null;
};
```

```ts
// patient-detail-helpers.ts  (form state — age is UI-only)
export type PatientFormState = {
  fullName: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;     // persisted source of truth
  ageInput: string;      // UI-only, never sent as a key
  ageTouched: boolean;   // UI-only intent flag
  address: string;       // NEW
  phone: string;
  email: string;
  notes: string;
};
```

`computeAge` semantics: `age = floor((now - birthDate) / 365.25 days)`, clamped to `>= 0`. `ageToApproxBirthDate(age)` returns `new Date(Date.UTC(now.getUTCFullYear() - age, 6, 1))` (month index 6 = July). The submit step strips `ageInput`/`ageTouched` from the body — only `birthDate` (computed or verbatim) and `address` reach the wire.

## Migration / Rollout

```prisma
// schema.prisma diff
enum PatientSex {
  FEMALE
  MALE
  OTHER          // + added
}

model Patient {
  // ...
  email          String?
  address        String?   // + added, nullable
  // ...
}
```

```sql
-- generated migration.sql (additive, safe)
ALTER TYPE "PatientSex" ADD VALUE 'OTHER';
ALTER TABLE "Patient" ADD COLUMN "address" TEXT;
```

Command: `pnpm --filter web prisma migrate dev --name patient_demographics_expansion` (run against the docker DB first).

Postgres note: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on older PostgreSQL (< 12), and Prisma may emit the enum addition in its own migration step / outside a transaction. If `prisma migrate dev` reports the enum value cannot be added in a transaction, split into two migration steps (enum value first, column second) or apply the enum `ADD VALUE` in a standalone migration. Verify the generated SQL before merge. No `DROP`, no `DEFAULT`, no `NOT NULL` — existing rows are untouched, and `address` defaults to `NULL`.

**Backup step (mandatory before applying to any non-disposable DB):** take a logical dump first, e.g. `pg_dump -Fc "$DATABASE_URL" -f patient-demographics-pre-migration.dump`. The migration is additive and reversible, but a dump is the cheap insurance before an `ALTER TYPE`/`ALTER TABLE`. Rollback: drop the `address` column; the `OTHER` enum value can remain harmlessly (removing an enum value requires recreating the type, only do so if no row uses it).

## Layout

Goal: Teléfono/Email stop looking "descuadrado" by giving both forms a deterministic field order and explicit spans instead of letting `auto-fit` pack fields unpredictably. Mobile stays single-column in both forms; no responsive regression.

**Canonical field order (both forms):**
1. Nombre completo (full width)
2. Sexo | Tipo de documento (two columns)
3. Número de documento | Fecha de nacimiento (two columns)
4. Edad | Teléfono (two columns)
5. Email | (Dirección starts here, see below)
6. Dirección (full width)
7. Notas (full width)

This pairs Teléfono and Email into stable two-column rows and keeps Edad adjacent to Fecha de nacimiento so the age/DOB relationship reads naturally.

**Edit form — CSS module (`page.module.css` + `patient-detail-client.tsx`):**
- Keep `.formGrid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }` as the base — it already collapses to one column on narrow screens.
- Mark `Dirección` and `Notas` with `className={styles.fullWidthField}` (`grid-column: 1 / -1`) so they always span the full row and don't leave Teléfono/Email orphaned in a half row.
- Render fields in the canonical order above so `auto-fit` produces predictable pairs rather than guessing.
- Edad: render right after Fecha de nacimiento. When `form.birthDate` is non-empty, render Edad as a read-only computed value (`computeAge`); when empty, render an editable number input that sets `ageTouched`.

**Create form — Tailwind (`patients-client.tsx`):**
- Reuse the existing `grid grid-cols-1 gap-5 sm:grid-cols-2` wrapper pattern (already used for Sexo/Tipo de documento at line 284) to pair: (Sexo, Tipo de documento), (Número de documento, Fecha de nacimiento), (Edad, Teléfono), (Email + Dirección on its own full-width row).
- Dirección and Notas render full width (`col-span` / standalone `label`), matching the edit form.
- Base `grid-cols-1` keeps mobile single-column; `sm:grid-cols-2` restores pairs on tablet/desktop. No new breakpoints introduced.

UI strings (neutral Spanish): "Otro", "Dirección", "Edad", existing "Fecha de nacimiento" / "Teléfono" / "Email" unchanged.

## Testing Strategy

Strict TDD: write the helper and parser tests RED before implementing.

| Layer | What to Test | Approach |
|---|---|---|
| Unit (RED first) | `computeAge(dob, now)` whole-year boundaries (birthday today, day before, leap-year DOB); `>= 0` clamp | `node:test` in new `patient-age.test.ts`. |
| Unit (RED first) | `ageToApproxBirthDate(age, now)` returns July 1 of `currentYear - age`; round-trips with `computeAge` within ±1 year | `patient-age.test.ts`. |
| Unit (RED first) | `formatISODate` UTC `YYYY-MM-DD` for known dates | `patient-age.test.ts`. |
| Unit | `parsePatientSex` accepts `OTHER`; still rejects garbage; updated error message | Extend `patients-input.test.ts`. |
| Unit | `address` parsed, trimmed, nullable, max-length bounded; allowed in update (`rejectUnknownFields`) and create | `patients-input.test.ts`. |
| Unit | Existing `parseBirthDate` behavior unchanged (regression) | `patients-input.test.ts`. |
| Regression | `resolveBodyFigureSex("OTHER")` → `female` | `body-figure-sex.test.ts`. |
| Behavior (helper-level) | Disambiguation: when `ageTouched` false, outgoing `birthDate` equals the exact stored value; when true, equals `ageToApproxBirthDate(age)` | Cover via the pure compute step if extracted, else assert in form-helper test. |

No E2E framework configured; layout verified manually on mobile + desktop.

## Component / Modification List (file:line)

- `apps/web/prisma/schema.prisma:64-67` — add `OTHER`; `:75-77` — add `address String?`.
- `apps/web/lib/patients-input.ts:8-11` — `OTHER` in `PATIENT_SEX`; `:15-24` — `address` in type; `:38-47` — `EDITABLE_PATIENT_FIELDS`; `:56-69` — `parsePatientSex` accept `OTHER`; `:167-201` — parse + return `address`.
- `apps/web/lib/patients.ts:48,99` — persist `address` in create/update.
- `apps/web/lib/patient-age.ts` — new pure module.
- `apps/web/app/patients/[id]/patient-detail-helpers.ts:1-13,54-63,100-118` — `PatientDetail.address`, form state, `OTHER` option, `patientToFormState` mapping + initial `ageInput`.
- `apps/web/app/patients/[id]/patient-detail-client.tsx:187,374-449` — submit disambiguation + Dirección/Edad fields + reorder/span.
- `apps/web/app/patients/patients-client.tsx:21-41,128,284-361` — form state, submit disambiguation, Tailwind fields.
- `apps/web/app/patients/page.module.css:320-352` — spans/order, preserve responsive base.
- API routes `app/api/patients/route.ts`, `app/api/patients/[id]/route.ts` — no change (passthrough).

## Review Workload Forecast

| Slice | Files | Est. changed lines |
|---|---|---|
| Migration + schema | `schema.prisma`, `migration.sql` | ~12 |
| Parsers + persistence | `patients-input.ts`, `patients.ts` | ~40 |
| Pure helper | `patient-age.ts` | ~35 |
| Tests | `patient-age.test.ts`, `patients-input.test.ts`, `body-figure-sex.test.ts` | ~120 |
| Edit form + helpers | `patient-detail-client.tsx`, `patient-detail-helpers.ts` | ~90 |
| Create form | `patients-client.tsx` | ~55 |
| CSS layout | `page.module.css` | ~20 |
| **Total** | | **~370** |

Estimated total ~370 changed lines — **under the 400 budget**, so a **single PR is viable**. The estimate is close to the threshold and includes two UI files plus a migration, so if implementation overruns 400, split into **two chained PRs**:

- **PR1 (foundation):** migration + schema + `patients-input.ts` + `patients.ts` + `patient-age.ts` + all unit/regression tests. Self-contained, independently reviewable, green on its own (parsers accept new inputs; helper covered).
- **PR2 (UI):** both forms + helpers form-state + CSS layout. Depends on PR1's parser/helper contract.

**Decision needed before apply:** No (single PR), unless line count overruns 400 during implementation, in which case use the chained split above.

## Open Questions

None. The age-vs-date disambiguation rule (preserve exact DOB unless Edad is deliberately edited) is fixed by the `ageTouched` flag in the design.
