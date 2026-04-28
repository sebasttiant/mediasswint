import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import { handleGetPatientRequest, handlePatchPatientRequest, type PatientRouteDeps } from "../app/api/patients/[id]/route";
import { handleGetPatientsRequest, type PatientsRouteDeps } from "../app/api/patients/route";

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff User",
  role: "STAFF",
};

function request(path = "/api/patients") {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `${getSessionCookieName()}=token` },
  });
}

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: {
      cookie: `${getSessionCookieName()}=token`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createPatientRouteDeps(overrides: Partial<PatientRouteDeps> = {}): PatientRouteDeps {
  return {
    requireActiveUser: async () => staffUser,
    get: async () => ({
      ok: true,
      value: {
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
      },
    }),
    update: async (id, input) => ({
      ok: true,
      value: {
        id,
        fullName: input.fullName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate: input.birthDate,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z"),
      },
    }),
    ...overrides,
  };
}

describe("patients route auth", () => {
  it("returns 401 when the request has no active authenticated user", async () => {
    const deps: PatientsRouteDeps = {
      requireActiveUser: async () => null,
      list: async () => {
        throw new Error("must not list patients without auth");
      },
      create: async () => {
        throw new Error("unused");
      },
    };

    const response = await handleGetPatientsRequest(new Request("http://localhost/api/patients"), deps);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });

  it("returns 401 for an inactive user resolved by the active-user guard", async () => {
    const deps: PatientsRouteDeps = {
      requireActiveUser: async () => null,
      list: async () => {
        throw new Error("must not list patients for inactive users");
      },
      create: async () => {
        throw new Error("unused");
      },
    };

    const response = await handleGetPatientsRequest(request(), deps);

    assert.equal(response.status, 401);
  });

  it("allows an active STAFF user to list patients", async () => {
    const deps: PatientsRouteDeps = {
      requireActiveUser: async () => staffUser,
      list: async () => ({
        ok: true,
        value: [
          {
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
          },
        ],
      }),
      create: async () => {
        throw new Error("unused");
      },
    };

    const response = await handleGetPatientsRequest(request("/api/patients?limit=20"), deps);
    const payload = (await response.json()) as Array<{ id: string; fullName: string }>;

    assert.equal(response.status, 200);
    assert.equal(payload.length, 1);
    assert.equal(payload[0]?.fullName, "Ada Lovelace");
  });

  it("applies the same active-user guard to patient detail", async () => {
    const deps: PatientRouteDeps = {
      requireActiveUser: async () => staffUser,
      update: async () => {
        throw new Error("unused");
      },
      get: async () => ({
        ok: true,
        value: {
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
        },
      }),
    };

    const response = await handleGetPatientRequest(request("/api/patients/pat-1"), { params: Promise.resolve({ id: "pat-1" }) }, deps);
    const payload = (await response.json()) as { id: string; fullName: string };

    assert.equal(response.status, 200);
    assert.equal(payload.id, "pat-1");
  });

  it("returns 401 for PATCH without an active user", async () => {
    const deps = createPatientRouteDeps({
      requireActiveUser: async () => null,
      update: async () => {
        throw new Error("must not update without auth");
      },
    });

    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-1", { fullName: "Updated" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  });

  it("returns 400 for PATCH invalid JSON", async () => {
    const deps = createPatientRouteDeps();
    const response = await handlePatchPatientRequest(
      new Request("http://localhost/api/patients/pat-1", {
        method: "PATCH",
        headers: { cookie: `${getSessionCookieName()}=token` },
        body: "{not-json",
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      deps,
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      errors: [{ field: "body", message: "invalid JSON body" }],
    });
  });

  it("returns 400 for PATCH validation errors", async () => {
    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-1", { fullName: "" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      createPatientRouteDeps(),
    );

    const payload = (await response.json()) as { errors: Array<{ field: string }> };
    assert.equal(response.status, 400);
    assert.equal(payload.errors.some((error) => error.field === "fullName"), true);
  });

  it("returns 404 when PATCH target patient is missing", async () => {
    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-missing", { fullName: "Updated" }),
      { params: Promise.resolve({ id: "pat-missing" }) },
      createPatientRouteDeps({ update: async () => ({ ok: false, error: "NOT_FOUND" }) }),
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Patient not found" });
  });

  it("returns 409 when PATCH document conflicts", async () => {
    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-1", { fullName: "Updated", documentType: "DNI", documentNumber: "123" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      createPatientRouteDeps({ update: async () => ({ ok: false, error: "CONFLICT" }) }),
    );

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Patient document already exists" });
  });

  it("returns 500 when PATCH update fails for an unknown reason", async () => {
    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-1", { fullName: "Updated" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      createPatientRouteDeps({ update: async () => ({ ok: false, error: "UNKNOWN" }) }),
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Internal server error" });
  });

  it("allows active STAFF users to PATCH full-form patient updates", async () => {
    const response = await handlePatchPatientRequest(
      jsonRequest("/api/patients/pat-1", { fullName: "Updated Patient" }),
      { params: Promise.resolve({ id: "pat-1" }) },
      createPatientRouteDeps(),
    );
    const payload = (await response.json()) as { id: string; fullName: string; documentType: string | null };

    assert.equal(response.status, 200);
    assert.equal(payload.id, "pat-1");
    assert.equal(payload.fullName, "Updated Patient");
    assert.equal(payload.documentType, null);
  });
});
