import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCreatePatientInput, parseListPatientsQuery } from "../lib/patients-input";

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
