import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMeasurementDetailHref,
  buildNewMeasurementHref,
  buildPatientDetailHref,
  executePatientSaveNavigation,
  patientToFormState,
} from "../app/patients/[id]/patient-detail-helpers";

describe("patient detail client helpers", () => {
  it("seeds editable form state from initialPatient without requiring a client detail fetch", () => {
    const formState = patientToFormState({
      id: "pat-1",
      fullName: "Ada Lovelace",
      documentType: "DNI",
      documentNumber: "123",
      birthDate: "1815-12-10T00:00:00.000Z",
      phone: null,
      email: "ada@example.com",
      notes: null,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });

    assert.deepEqual(formState, {
      fullName: "Ada Lovelace",
      documentType: "DNI",
      documentNumber: "123",
      birthDate: "1815-12-10",
      phone: "",
      email: "ada@example.com",
      notes: "",
    });
  });

  it("builds list row/name navigation hrefs to patient detail", () => {
    assert.equal(buildPatientDetailHref("pat-123"), "/patients/pat-123");
    assert.equal(buildPatientDetailHref("pat with space"), "/patients/pat%20with%20space");
  });

  it("builds measurement navigation hrefs under the patient detail", () => {
    assert.equal(buildNewMeasurementHref("pat-123"), "/patients/pat-123/measurements/new");
    assert.equal(
      buildMeasurementDetailHref("pat with space", "sess/1"),
      "/patients/pat%20with%20space/measurements/sess%2F1",
    );
  });

  it("refreshes the route cache before pushing back to patients after save", () => {
    const calls: string[] = [];

    executePatientSaveNavigation({
      refresh: () => calls.push("refresh"),
      push: (href) => calls.push(`push:${href}`),
    });

    assert.deepEqual(calls, ["refresh", "push:/patients"]);
  });
});
