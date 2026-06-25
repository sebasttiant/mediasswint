# Delta for Web Patients Demographics

> This is the first spec for the `web-patients-demographics` domain, so it is written as a full spec rather than a delta.

## Non-Goals

- Health entity / EPS dropdown is explicitly **out of scope** here. It belongs to the separate future change **`patient-health-entity`**.
- Structured address (street, city, postal code).
- Stored age column or any backfill of existing patient records.
- New body figures or changes to `resolveBodyFigureSex` beyond confirming the existing `OTHER`→female fallback.

---

## Requirements

### Requirement: PatientSex Third Option

The `PatientSex` enum MUST include a third value `OTHER`. The UI label for `OTHER` MUST be "Otro". The input parser `parsePatientSex` MUST accept `OTHER` as a valid value. `PATIENT_SEX_OPTIONS` MUST include `{ value: "OTHER", label: "Otro" }`. Both the create form and the edit form MUST expose "Otro" as a selectable sex option. The anatomical figure MUST fall back to the female silhouette when sex is `OTHER`; no figure-resolution code changes are required because the existing `resolveBodyFigureSex` non-MALE fallback already covers it.

#### Scenario: User selects "Otro" on create form

- GIVEN the create patient form is open
- WHEN the user selects "Otro" from the sex field
- THEN the form MUST accept and submit `OTHER` as the sex value
- AND the saved patient MUST have `sex = OTHER`

#### Scenario: "Otro" patient displays female anatomical figure

- GIVEN a patient with `sex = OTHER` is loaded in the measurement UI
- WHEN the anatomical figure is resolved
- THEN the female silhouette MUST be shown
- AND the measurement capture MUST proceed without errors

#### Scenario: Edit form shows "Otro" as current selection

- GIVEN a patient with `sex = OTHER` is opened in the edit form
- WHEN the sex field renders
- THEN "Otro" MUST be the selected option
- AND the form MUST save without validation errors when submitted unchanged

#### Scenario: Parser rejects unknown sex values

- GIVEN an API request includes an unrecognized sex string (e.g. "UNKNOWN")
- WHEN `parsePatientSex` processes the value
- THEN the parser MUST reject it and return a validation error
- AND `OTHER` MUST NOT be rejected

---

### Requirement: Free-text Address Field

The `Patient` model MUST gain a nullable free-text `address` field (`address String?`). The field is optional; existing patients without an address are unaffected. The `address` value MUST be trimmed before persistence. No complex format validation is required. The create form and the edit form MUST both render an input labeled "Dirección". The create and update API parsers MUST read, validate, and persist `address`.

#### Scenario: User saves a patient with an address

- GIVEN a create or edit patient form is open
- WHEN the user types a value in the "Dirección" field and saves
- THEN `address` MUST be persisted (trimmed) on the patient record
- AND reloading the form MUST show the saved value in "Dirección"

#### Scenario: Address is optional — empty address saves cleanly

- GIVEN a create or edit form with the "Dirección" field left blank
- WHEN the form is submitted
- THEN the patient MUST save with `address = null`
- AND no validation error MUST be returned for a missing address

#### Scenario: Address value is trimmed before save

- GIVEN the user enters "  Calle 123  " (leading/trailing spaces)
- WHEN the form is submitted
- THEN the persisted `address` MUST be "Calle 123"

---

### Requirement: Age Entry with Preserved BirthDate

The `Patient` model MUST retain `birthDate DateTime?` as the sole stored source of truth for birth date. A stored age column MUST NOT be added.

**Edit form — patient with existing `birthDate`:** The form MUST show "Fecha de nacimiento" as an editable date field and MUST show "Edad" as a read-only computed display (age = `floor((now − birthDate) / 365.25 days)`). The user MUST NOT be able to type directly into the "Edad" field to change the age; to change age the user edits "Fecha de nacimiento". Editing and saving any other field MUST NOT modify the stored `birthDate`.

**Edit form — patient with NO `birthDate`:** The form MAY allow the user to enter either an exact date in "Fecha de nacimiento" OR an approximate age in "Edad". Entering an age computes `birthDate = July 1 of (currentYear − age)` and stores that date.

**Create form:** The user MAY enter either an exact birth date via "Fecha de nacimiento" OR an approximate age via "Edad". Entering an exact date stores it verbatim. Entering an age stores July 1 of (currentYear − age) as `birthDate`. Entering both is not expected; if both are supplied the exact date SHOULD take precedence.

The age→birthDate and birthDate→age conversions MUST be implemented as pure helper functions covered by unit tests.

#### Scenario: Edit form — patient with exact DOB shows computed age (read-only)

- GIVEN a patient has `birthDate = 1990-03-15`
- WHEN the edit form loads
- THEN "Fecha de nacimiento" MUST display `1990-03-15` as an editable field
- AND "Edad" MUST display the computed age (e.g. 35 if today is 2026-06-24) as a read-only value
- AND the "Edad" input MUST be disabled or non-interactive

#### Scenario: Edit form — saving other fields does not alter DOB

- GIVEN a patient has `birthDate = 1990-03-15`
- WHEN the user changes only the "Dirección" field and saves
- THEN the patient's `birthDate` MUST remain `1990-03-15`
- AND the computed "Edad" MUST be unchanged after reload

#### Scenario: Create form — user enters age only

- GIVEN the create form is open and the user leaves "Fecha de nacimiento" blank
- WHEN the user types `30` in "Edad" and submits
- THEN the stored `birthDate` MUST be `{currentYear - 30}-07-01`
- AND reloading the form MUST compute "Edad" as approximately 30

#### Scenario: Create form — user enters exact date

- GIVEN the create form is open and the user fills "Fecha de nacimiento" with `1994-11-20`
- WHEN the form is submitted
- THEN the stored `birthDate` MUST be exactly `1994-11-20`
- AND the "Edad" display MUST reflect the computed age from that exact date

#### Scenario: Edit form — patient with no DOB may enter age

- GIVEN a patient has no stored `birthDate`
- WHEN the user types `45` in "Edad" on the edit form and saves
- THEN the stored `birthDate` MUST be `{currentYear - 45}-07-01`

---

### Requirement: Responsive Demographic Form Layout

Both the patient edit form (`patient-detail-client.tsx`, CSS-module grid `.formGrid`) and the create form (`patients-client.tsx`, Tailwind-based) MUST render a clean, predictable responsive grid. The grid MUST be single-column on mobile and expand to a multi-column layout on wider viewports. Fields that benefit from full-width rendering (Dirección, Notas) MUST span the full row. The new "Dirección" and "Edad" / "Fecha de nacimiento" fields MUST be placed in a consistent, predictable position relative to existing fields. The misalignment of Teléfono/Email that exists today MUST be resolved. The responsive behavior of existing fields MUST NOT regress. Both forms MUST visually match in field order and grid structure.

#### Scenario: Single-column layout on mobile

- GIVEN the patient form (create or edit) is rendered on a narrow viewport (< 640 px)
- WHEN all fields are visible
- THEN every field MUST stack vertically in a single column
- AND no field MUST overflow horizontally

#### Scenario: Multi-column layout on wider viewports

- GIVEN the patient form is rendered on a desktop viewport (≥ 640 px)
- WHEN the demographic fields are displayed
- THEN the form MUST display fields in two or more columns
- AND Teléfono and Email MUST be aligned to the same row or in a visually predictable sequence

#### Scenario: Full-width fields for Dirección and Notas

- GIVEN the form is in any viewport
- WHEN "Dirección" or "Notas" is visible
- THEN each MUST span the full available row width

#### Scenario: New fields placed without layout regression

- GIVEN the edit form includes the new "Dirección", "Fecha de nacimiento", and "Edad" fields
- WHEN rendered on both mobile and desktop viewports
- THEN all existing fields (Nombre, Documento, Teléfono, Email, Sexo, Notas) MUST remain correctly aligned and fully visible

---

## Non-functional Requirements

- The change MUST NOT reduce the test count below 639; all existing tests MUST remain green.
- TypeScript strict mode MUST be maintained; `any` MUST NOT be introduced.
- Lint MUST pass clean (`next lint` or equivalent).
- Validation MUST use manual patterns (no Zod); the existing `parseNullableString` and related helpers SHOULD be reused for `address`.
- Commits MUST follow conventional commit format.
- The Prisma migration MUST be additive and nullable; existing patient records MUST NOT be modified.
- `resolveBodyFigureSex` MUST NOT be changed; a regression test MUST confirm `OTHER` resolves to the female silhouette.
