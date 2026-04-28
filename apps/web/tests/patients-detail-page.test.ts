import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Patient } from "@prisma/client";

import { resolvePatientDetailLoad } from "../app/patients/[id]/patient-detail-loading";

function patientFixture(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pat-1",
    fullName: "Ada Lovelace",
    documentType: "DNI",
    documentNumber: "123",
    birthDate: null,
    phone: null,
    email: null,
    notes: null,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("resolvePatientDetailLoad", () => {
  it("requires login when no active user exists", () => {
    assert.deepEqual(resolvePatientDetailLoad(null, { ok: true, value: patientFixture() }), {
      action: "redirect",
      location: "/login",
    });
  });

  it("returns initial patient for active STAFF users", () => {
    const patient = patientFixture({ id: "pat-2", fullName: "Grace Hopper" });

    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: true, value: patient }), {
      action: "render",
      patient,
    });
  });

  it("maps missing patient result to notFound", () => {
    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: false, error: "NOT_FOUND" }), {
      action: "notFound",
    });
  });

  it("maps unknown lookup failures to throw", () => {
    assert.deepEqual(resolvePatientDetailLoad({ id: "staff-1", role: "STAFF" }, { ok: false, error: "UNKNOWN" }), {
      action: "throw",
    });
  });
});
