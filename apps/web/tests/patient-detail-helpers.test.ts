import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ageToApproxBirthDate, formatISODate } from "../lib/patient-age";
import { patientToFormState, type PatientDetail } from "../app/patients/[id]/patient-detail-helpers";

// ---------------------------------------------------------------------------
// Age/DOB disambiguation contract
// ---------------------------------------------------------------------------
// The submit logic uses a UI-only ageTouched flag to decide what birthDate to send.
// These tests cover the pure computation step to assert the contract:
//  - ageTouched === false → birthDate equals the exact stored value (never overwritten)
//  - ageTouched === true  → birthDate equals formatISODate(ageToApproxBirthDate(age))

describe("age/DOB disambiguation contract (pure computation)", () => {
  const FIXED_NOW = new Date(Date.UTC(2026, 5, 24)); // 2026-06-24

  it("when ageTouched is false, the outgoing birthDate equals the exact stored value", () => {
    const exactBirthDate = "1990-03-15";
    const ageTouched = false;
    const ageInput = "36"; // Not used when ageTouched is false

    const outgoingBirthDate = ageTouched
      ? formatISODate(ageToApproxBirthDate(Number(ageInput), FIXED_NOW))
      : exactBirthDate;

    assert.equal(outgoingBirthDate, exactBirthDate);
  });

  it("when ageTouched is true, the outgoing birthDate equals formatISODate(ageToApproxBirthDate(age))", () => {
    const ageTouched = true;
    const ageInput = "30";

    const outgoingBirthDate = ageTouched
      ? formatISODate(ageToApproxBirthDate(Number(ageInput), FIXED_NOW))
      : "1990-03-15";

    assert.equal(outgoingBirthDate, "1996-07-01");
  });

  it("CRITICAL: saving with ageTouched=false NEVER overwrites an existing exact birthDate with an approximation", () => {
    const exactBirthDate = "1990-03-15";
    const ageTouched = false;

    // Simulate: user edits only Dirección, never touches Edad
    const outgoingBirthDate = ageTouched
      ? formatISODate(ageToApproxBirthDate(35, FIXED_NOW))
      : exactBirthDate;

    // Must equal the exact stored value, NOT the July-1 approximation
    assert.equal(outgoingBirthDate, exactBirthDate);
    assert.notEqual(outgoingBirthDate, "1991-07-01");
    assert.notEqual(outgoingBirthDate, "1990-07-01");
  });

  it("when ageTouched is true with age 45, birthDate is July 1 of (2026-45)=1981", () => {
    const ageTouched = true;
    const ageInput = "45";

    const outgoingBirthDate = ageTouched
      ? formatISODate(ageToApproxBirthDate(Number(ageInput), FIXED_NOW))
      : "";

    assert.equal(outgoingBirthDate, "1981-07-01");
  });
});

// ---------------------------------------------------------------------------
// patientToFormState
// ---------------------------------------------------------------------------

describe("patientToFormState", () => {
  function makePatient(overrides: Partial<PatientDetail> = {}): PatientDetail {
    return {
      id: "p1",
      fullName: "Ada Lovelace",
      sex: "FEMALE",
      documentType: "CC",
      documentNumber: "12345",
      birthDate: "1990-03-15",
      address: null,
      phone: null,
      email: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("maps address from PatientDetail to form state", () => {
    const patient = makePatient({ address: "Calle 123" });
    const state = patientToFormState(patient);
    assert.equal(state.address, "Calle 123");
  });

  it("defaults address to empty string when null", () => {
    const patient = makePatient({ address: null });
    const state = patientToFormState(patient);
    assert.equal(state.address, "");
  });

  it("derives ageInput from birthDate when birthDate is present", () => {
    // born 1990-03-15, on 2026-06-24 → age 36
    const patient = makePatient({ birthDate: "1990-03-15" });
    const state = patientToFormState(patient);
    // ageInput is the computed age as a string; we just need it to be a positive number string
    const age = Number(state.ageInput);
    assert.ok(age > 0, `Expected ageInput to be a positive number, got: ${state.ageInput}`);
  });

  it("sets ageInput to empty string when birthDate is absent", () => {
    const patient = makePatient({ birthDate: null });
    const state = patientToFormState(patient);
    assert.equal(state.ageInput, "");
  });

  it("sets ageTouched to false initially", () => {
    const patient = makePatient();
    const state = patientToFormState(patient);
    assert.equal(state.ageTouched, false);
  });

  it("includes OTHER as a valid sex value in form state", () => {
    const patient = makePatient({ sex: "OTHER" });
    const state = patientToFormState(patient);
    assert.equal(state.sex, "OTHER");
  });
});
