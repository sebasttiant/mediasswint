import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCreatePatientInput, parseListPatientsQuery, parseUpdatePatientInput } from "../lib/patients-input";

describe("parseCreatePatientInput", () => {
  it("returns parsed payload for valid body", () => {
    const result = parseCreatePatientInput({
      fullName: " Ada Lovelace ",
      documentType: " DNI ",
      documentNumber: " 123 ",
      birthDate: "1815-12-10",
      phone: "555-123",
      email: "ada@example.com",
      notes: "First programmer",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.fullName, "Ada Lovelace");
    assert.equal(result.value.documentType, "DNI");
    assert.equal(result.value.documentNumber, "123");
    assert.equal(result.value.birthDate?.toISOString(), "1815-12-10T00:00:00.000Z");
  });

  it("returns errors for invalid body", () => {
    const result = parseCreatePatientInput({ fullName: "", birthDate: "10/12/1815" });
    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.errors.some((error) => error.field === "fullName"), true);
    assert.equal(result.errors.some((error) => error.field === "birthDate"), true);
  });
});

describe("parseListPatientsQuery", () => {
  it("uses defaults when query is empty", () => {
    const result = parseListPatientsQuery(new URLSearchParams());

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.q, null);
    assert.equal(result.value.limit, 20);
  });

  it("returns error for invalid limit", () => {
    const result = parseListPatientsQuery(new URLSearchParams({ limit: "0" }));

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.deepEqual(result.errors, [{ field: "limit", message: "must be between 1 and 100" }]);
  });
});

describe("parseUpdatePatientInput", () => {
  it("normalizes absent optional fields to null for a full-form update", () => {
    const result = parseUpdatePatientInput({ fullName: " Grace Hopper " });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.deepEqual(result.value, {
      fullName: "Grace Hopper",
      documentType: null,
      documentNumber: null,
      birthDate: null,
      phone: null,
      email: null,
      notes: null,
    });
  });

  it("normalizes blank optional fields to null and parses birthDate", () => {
    const result = parseUpdatePatientInput({
      fullName: " Alan Turing ",
      documentType: " ",
      documentNumber: null,
      birthDate: "1912-06-23",
      phone: " ",
      email: " alan@example.com ",
      notes: " ",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.fullName, "Alan Turing");
    assert.equal(result.value.documentType, null);
    assert.equal(result.value.documentNumber, null);
    assert.equal(result.value.birthDate?.toISOString(), "1912-06-23T00:00:00.000Z");
    assert.equal(result.value.phone, null);
    assert.equal(result.value.email, "alan@example.com");
    assert.equal(result.value.notes, null);
  });

  it("returns validation errors for blank fullName and invalid birthDate", () => {
    const result = parseUpdatePatientInput({ fullName: " ", birthDate: "23/06/1912" });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.errors.some((error) => error.field === "fullName"), true);
    assert.equal(result.errors.some((error) => error.field === "birthDate"), true);
  });

  it("returns validation errors for max length violations", () => {
    const result = parseUpdatePatientInput({
      fullName: "A".repeat(121),
      documentType: "D".repeat(61),
      notes: "N".repeat(1001),
    });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.errors.some((error) => error.field === "fullName"), true);
    assert.equal(result.errors.some((error) => error.field === "documentType"), true);
    assert.equal(result.errors.some((error) => error.field === "notes"), true);
  });

  it("rejects fields outside the editable patient shape", () => {
    const result = parseUpdatePatientInput({ fullName: "Ada Lovelace", isDeleted: true });

    assert.deepEqual(result, {
      ok: false,
      errors: [{ field: "isDeleted", message: "is not allowed" }],
    });
  });
});
