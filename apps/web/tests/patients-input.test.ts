import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCreatePatientInput, parseListPatientsQuery, parseUpdatePatientInput } from "../lib/patients-input";
import { PATIENT_SEX } from "../lib/patients-input";

describe("parseCreatePatientInput", () => {
  it("returns parsed payload for valid body", () => {
    const result = parseCreatePatientInput({
      fullName: " Ada Lovelace ",
      sex: "FEMALE",
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
    assert.equal(result.value.sex, "FEMALE");
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
      sex: null,
      documentType: null,
      documentNumber: null,
      birthDate: null,
      address: null,
      healthInsurance: null,
      phone: null,
      email: null,
      notes: null,
    });
  });

  it("normalizes blank optional fields to null and parses birthDate", () => {
    const result = parseUpdatePatientInput({
      fullName: " Alan Turing ",
      sex: "MALE",
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
    assert.equal(result.value.sex, "MALE");
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

  it("returns validation errors for unsupported sex values", () => {
    const result = parseUpdatePatientInput({ fullName: "Ada Lovelace", sex: "INVALID_VALUE" });

    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.deepEqual(result.errors, [{ field: "sex", message: "must be FEMALE, MALE, or OTHER" }]);
  });

  it("rejects fields outside the editable patient shape", () => {
    const result = parseUpdatePatientInput({ fullName: "Ada Lovelace", isDeleted: true });

    assert.deepEqual(result, {
      ok: false,
      errors: [{ field: "isDeleted", message: "is not allowed" }],
    });
  });
});

describe("PATIENT_SEX — OTHER value", () => {
  it("exports OTHER as a valid key", () => {
    assert.equal(PATIENT_SEX.OTHER, "OTHER");
  });

  it("parseCreatePatientInput accepts OTHER as a valid sex value", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", sex: "OTHER" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.sex, "OTHER");
  });

  it("parseUpdatePatientInput accepts OTHER as a valid sex value", () => {
    const result = parseUpdatePatientInput({ fullName: "Test Patient", sex: "OTHER" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.sex, "OTHER");
  });

  it("parsePatientSex rejects an unrecognized value like UNKNOWN", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", sex: "UNKNOWN" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "sex"));
  });

  it("parsePatientSex still accepts FEMALE and MALE", () => {
    const female = parseCreatePatientInput({ fullName: "Test", sex: "FEMALE" });
    const male = parseCreatePatientInput({ fullName: "Test", sex: "MALE" });
    assert.equal(female.ok, true);
    assert.equal(male.ok, true);
  });
});

describe("address field parsing", () => {
  it("parses and trims a valid address in create", () => {
    const result = parseCreatePatientInput({
      fullName: "Test Patient",
      address: "  Calle 123  ",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, "Calle 123");
  });

  it("normalizes an empty address string to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", address: "" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, null);
  });

  it("normalizes a missing address key to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, null);
  });

  it("normalizes a whitespace-only address to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", address: "   " });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, null);
  });

  it("rejects an address that exceeds 160 characters", () => {
    const longAddress = "A".repeat(161);
    const result = parseCreatePatientInput({ fullName: "Test Patient", address: longAddress });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "address"));
  });

  it("accepts an address of exactly 160 characters", () => {
    const maxAddress = "B".repeat(160);
    const result = parseCreatePatientInput({ fullName: "Test Patient", address: maxAddress });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, maxAddress);
  });

  it("allows address in PATCH (rejectUnknownFields)", () => {
    const result = parseUpdatePatientInput({ fullName: "Test Patient", address: "Calle 456" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.address, "Calle 456");
  });
});

describe("healthInsurance field parsing", () => {
  it("parses and trims a valid health insurer in create", () => {
    const result = parseCreatePatientInput({
      fullName: "Test Patient",
      healthInsurance: "  Nueva EPS  ",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, "Nueva EPS");
  });

  it("normalizes an empty healthInsurance string to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", healthInsurance: "" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, null);
  });

  it("normalizes a missing healthInsurance key to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, null);
  });

  it("normalizes a whitespace-only healthInsurance to null", () => {
    const result = parseCreatePatientInput({ fullName: "Test Patient", healthInsurance: "   " });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, null);
  });

  it("rejects a healthInsurance that exceeds 120 characters", () => {
    const longInsurer = "A".repeat(121);
    const result = parseCreatePatientInput({ fullName: "Test Patient", healthInsurance: longInsurer });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "healthInsurance"));
  });

  it("accepts a healthInsurance of exactly 120 characters", () => {
    const maxInsurer = "B".repeat(120);
    const result = parseCreatePatientInput({ fullName: "Test Patient", healthInsurance: maxInsurer });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, maxInsurer);
  });

  it("allows healthInsurance in PATCH (rejectUnknownFields)", () => {
    const result = parseUpdatePatientInput({ fullName: "Test Patient", healthInsurance: "Sura EPS" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, "Sura EPS");
  });

  it("normalizes absent healthInsurance to null in full-form update", () => {
    const result = parseUpdatePatientInput({ fullName: "Grace Hopper" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.healthInsurance, null);
  });
});

describe("parseBirthDate regression", () => {
  it("still parses valid YYYY-MM-DD birth dates", () => {
    const result = parseCreatePatientInput({ fullName: "Test", birthDate: "1990-03-15" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.birthDate?.toISOString(), "1990-03-15T00:00:00.000Z");
  });

  it("still rejects invalid birth date formats", () => {
    const result = parseCreatePatientInput({ fullName: "Test", birthDate: "15/03/1990" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.field === "birthDate"));
  });

  it("still treats empty birthDate as null", () => {
    const result = parseCreatePatientInput({ fullName: "Test", birthDate: "" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.birthDate, null);
  });
});
