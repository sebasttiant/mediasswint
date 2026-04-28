import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import { handleGetPatientRequest, type PatientRouteDeps } from "../app/api/patients/[id]/route";
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
});
