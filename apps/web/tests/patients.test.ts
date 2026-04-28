import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Patient } from "@prisma/client";

import { createPatient, getPatient, listPatients, updatePatient, type PatientsRepository } from "../lib/patients";
import type { CreatePatientInput, UpdatePatientInput } from "../lib/patients-input";

function createPatientFixture(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "pat_1",
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

function createRepository(overrides: Partial<PatientsRepository> = {}): PatientsRepository {
  return {
    create: async () => createPatientFixture(),
    list: async () => [createPatientFixture()],
    getById: async () => createPatientFixture(),
    update: async () => createPatientFixture({ fullName: "Updated Patient" }),
    ...overrides,
  };
}

const createInput: CreatePatientInput = {
  fullName: "Ada Lovelace",
  documentType: "DNI",
  documentNumber: "123",
  birthDate: null,
  phone: null,
  email: null,
  notes: null,
};

const updateInput: UpdatePatientInput = {
  fullName: "Updated Patient",
  documentType: "DNI",
  documentNumber: "999",
  birthDate: null,
  phone: null,
  email: null,
  notes: null,
};

describe("createPatient", () => {
  it("returns created patient on success", async () => {
    const repository = createRepository();

    const result = await createPatient(createInput, repository);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.fullName, "Ada Lovelace");
  });

  it("maps prisma P2002 to conflict", async () => {
    const repository = createRepository({
      create: async () => {
        throw { code: "P2002" };
      },
    });

    const result = await createPatient(createInput, repository);
    assert.deepEqual(result, { ok: false, error: "CONFLICT" });
  });
});

describe("listPatients", () => {
  it("returns list result", async () => {
    const repository = createRepository({
      list: async () => [createPatientFixture({ id: "pat_2" })],
    });

    const result = await listPatients({ q: null, limit: 20 }, repository);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.length, 1);
    assert.equal(result.value[0]?.id, "pat_2");
  });
});

describe("getPatient", () => {
  it("returns not found when repository has no patient", async () => {
    const repository = createRepository({
      getById: async () => null,
    });

    const result = await getPatient("pat_missing", repository);
    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });
});

describe("updatePatient", () => {
  it("returns updated patient for active STAFF full-form data", async () => {
    const repository = createRepository({
      update: async (id, input) => createPatientFixture({ id, fullName: input.fullName }),
    });

    const result = await updatePatient("pat_1", updateInput, repository);

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.id, "pat_1");
    assert.equal(result.value.fullName, "Updated Patient");
  });

  it("maps a null repository update result to not found", async () => {
    const repository = createRepository({
      update: async () => null,
    });

    const result = await updatePatient("pat_missing", updateInput, repository);

    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });

  it("maps prisma P2025 to not found", async () => {
    const repository = createRepository({
      update: async () => {
        throw { code: "P2025" };
      },
    });

    const result = await updatePatient("pat_missing", updateInput, repository);

    assert.deepEqual(result, { ok: false, error: "NOT_FOUND" });
  });

  it("maps prisma P2002 to conflict", async () => {
    const repository = createRepository({
      update: async () => {
        throw { code: "P2002" };
      },
    });

    const result = await updatePatient("pat_1", updateInput, repository);

    assert.deepEqual(result, { ok: false, error: "CONFLICT" });
  });

  it("maps unknown repository failures to unknown", async () => {
    const repository = createRepository({
      update: async () => {
        throw new Error("database unavailable");
      },
    });

    const result = await updatePatient("pat_1", updateInput, repository);

    assert.deepEqual(result, { ok: false, error: "UNKNOWN" });
  });
});
