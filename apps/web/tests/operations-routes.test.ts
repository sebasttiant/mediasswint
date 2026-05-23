import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma, type CommercialOperationStatus } from "@prisma/client";

import { getSessionCookieName, type AuthUser } from "../lib/auth";
import {
  handleListOperationsRequest,
  handleCreateOperationRequest,
  type OperationsCollectionDeps,
} from "../app/api/patients/[id]/operations/route";
import {
  handleGetOperationRequest,
  handleUpdateOperationRequest,
  type OperationDeps,
} from "../app/api/patients/[id]/operations/[operationId]/route";
import {
  handleAddDepositRequest,
  type DepositDeps,
} from "../app/api/patients/[id]/operations/[operationId]/deposit/route";

const staffUser: AuthUser = {
  id: "staff-1",
  email: "staff@mediasswint.test",
  passwordHash: "hash",
  isActive: true,
  fullName: "Staff",
  role: "STAFF",
};

type MockOperation = {
  id: string;
  patientId: string;
  status: CommercialOperationStatus;
  totalAmount: Prisma.Decimal | null;
  depositPaid: Prisma.Decimal;
  garmentType: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  patient: { id: string; fullName: string } | null;
};

function createOp(overrides: Partial<MockOperation> & { id: string; patientId: string }): MockOperation {
  return {
    status: "PRESUPUESTO" as CommercialOperationStatus,
    totalAmount: null,
    depositPaid: newDecimal(0),
    garmentType: null,
    notes: null,
    createdAt: new Date("2026-05-01T12:00:00Z"),
    updatedAt: new Date("2026-05-01T12:00:00Z"),
    patient: { id: overrides.patientId, fullName: "Test Patient" },
    ...overrides,
  };
}

function newDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function buildCollectionDeps(store: {
  operations: Map<string, MockOperation>;
  knownPatientIds: string[];
}): OperationsCollectionDeps {
  return {
    listOperations: async (patientId) => {
      if (!store.knownPatientIds.includes(patientId)) {
        return { ok: false, error: "NOT_FOUND" as const };
      }
      const items = [...store.operations.values()]
        .filter((op) => op.patientId === patientId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { ok: true, value: items };
    },
    createOperation: async (patientId, input) => {
      if (!store.knownPatientIds.includes(patientId)) {
        return { ok: false, error: "NOT_FOUND" as const };
      }
      const id = `op-${store.operations.size + 1}`;
      const now = new Date();
      const op = createOp({
        id,
        patientId,
        garmentType: input.garmentType ?? null,
        totalAmount: input.totalAmount ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      store.operations.set(id, op);
      return { ok: true, value: op };
    },
  };
}

function buildOperationDeps(store: {
  operations: Map<string, MockOperation>;
  knownPatientIds: string[];
}): OperationDeps {
  return {
    getOperation: async (patientId, operationId) => {
      const op = store.operations.get(operationId);
      if (!op || op.patientId !== patientId) {
        return { ok: false, error: "NOT_FOUND" as const };
      }
      return { ok: true, value: op };
    },
    updateOperation: async (patientId, operationId, input) => {
      const op = store.operations.get(operationId);
      if (!op || op.patientId !== patientId) {
        return { ok: false, error: "NOT_FOUND" as const };
      }
      if (op.status === "CANCELADO") {
        return { ok: false, error: "INVALID_OPERATION" as const };
      }
      if (input.depositPaid) {
        const parsed = typeof input.depositPaid === "object" && "toString" in input.depositPaid
          ? parseFloat(input.depositPaid.toString())
          : 0;
        if (parsed < 0) {
          return { ok: false, error: "INVALID_OPERATION" as const };
        }
        if (op.totalAmount && parsed > parseFloat(op.totalAmount.toString())) {
          return { ok: false, error: "INVALID_OPERATION" as const };
        }
      }
      const updated: MockOperation = {
        ...op,
        status: input.status ?? op.status,
        garmentType: input.garmentType !== undefined ? input.garmentType : op.garmentType,
        notes: input.notes !== undefined ? input.notes : op.notes,
        totalAmount: input.totalAmount !== undefined ? input.totalAmount : op.totalAmount,
        depositPaid: input.depositPaid !== undefined ? input.depositPaid : op.depositPaid,
        updatedAt: new Date(),
      };
      store.operations.set(operationId, updated);
      return { ok: true, value: updated };
    },
  };
}

function buildDepositDeps(store: {
  operations: Map<string, MockOperation>;
  knownPatientIds: string[];
}): DepositDeps {
  return {
    addDeposit: async (patientId, operationId, amount) => {
      const parsedAmount = parseFloat(amount.toString());
      if (parsedAmount <= 0) {
        return { ok: false, error: "INVALID_OPERATION" as const };
      }
      const op = store.operations.get(operationId);
      if (!op || op.patientId !== patientId) {
        return { ok: false, error: "NOT_FOUND" as const };
      }
      if (op.status === "CANCELADO") {
        return { ok: false, error: "INVALID_OPERATION" as const };
      }
      const currentDeposit = parseFloat(op.depositPaid.toString());
      const newDeposit = currentDeposit + parsedAmount;
      if (op.totalAmount && newDeposit > parseFloat(op.totalAmount.toString())) {
        return { ok: false, error: "INVALID_OPERATION" as const };
      }
      const updated = {
        ...op,
        depositPaid: newDecimal(newDeposit),
        updatedAt: new Date(),
      };
      store.operations.set(operationId, updated);
      return { ok: true, value: updated };
    },
  };
}

function authHeaders(): HeadersInit {
  return { cookie: `${getSessionCookieName()}=token` };
}

function buildRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: { ...authHeaders(), ...((init.headers ?? {}) as Record<string, string>) },
  });
}

describe("POST /api/patients/[id]/operations", () => {
  it("returns 400 on invalid JSON body", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildCollectionDeps(store);
    const response = await handleCreateOperationRequest(
      new Request("http://localhost/api/patients/pat-1/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{not-json",
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 400 when totalAmount is negative", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildCollectionDeps(store);
    const response = await handleCreateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations", {
        method: "POST",
        body: JSON.stringify({ garmentType: "Media", totalAmount: "-100" }),
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
    const json = (await response.json()) as { errors: Array<{ field: string }> };
    assert.equal(json.errors[0].field, "totalAmount");
  });

  it("returns 404 when patient does not exist", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: [] };
    const deps = buildCollectionDeps(store);
    const response = await handleCreateOperationRequest(
      buildRequest("http://localhost/api/patients/missing/operations", {
        method: "POST",
        body: JSON.stringify({ garmentType: "Media compresión" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("creates an operation and returns 201", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildCollectionDeps(store);
    const response = await handleCreateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations", {
        method: "POST",
        body: JSON.stringify({ garmentType: "Media corta", totalAmount: "150000", notes: "Paciente con edema" }),
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 201);
    const json = (await response.json()) as { id: string; garmentType: string; status: string };
    assert.ok(json.id);
    assert.equal(json.garmentType, "Media corta");
    assert.equal(json.status, "PRESUPUESTO");
    assert.equal(store.operations.size, 1);
  });

  it("creates operation without totalAmount (budget only)", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildCollectionDeps(store);
    const response = await handleCreateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations", {
        method: "POST",
        body: JSON.stringify({ garmentType: "Media larga" }),
      }),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 201);
    const json = (await response.json()) as { totalAmount: string | null };
    assert.equal(json.totalAmount, null);
  });
});

describe("GET /api/patients/[id]/operations", () => {
  it("returns 404 when patient not found", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: [] };
    const deps = buildCollectionDeps(store);
    const response = await handleListOperationsRequest(
      buildRequest("http://localhost/api/patients/missing/operations"),
      { params: Promise.resolve({ id: "missing" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("lists operations sorted by most recent first", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({
      id: "op-1", patientId: "pat-1", garmentType: "A",
      createdAt: new Date("2026-05-02T12:00:00Z"),
    }));
    store.operations.set("op-2", createOp({
      id: "op-2", patientId: "pat-1", garmentType: "B",
      createdAt: new Date("2026-05-03T12:00:00Z"),
    }));
    const deps = buildCollectionDeps(store);
    const response = await handleListOperationsRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations"),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { operations: Array<{ id: string; garmentType: string }> };
    assert.equal(json.operations.length, 2);
    assert.equal(json.operations[0].garmentType, "B"); // most recent first
  });

  it("returns empty list when patient has no operations", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildCollectionDeps(store);
    const response = await handleListOperationsRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations"),
      { params: Promise.resolve({ id: "pat-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { operations: Array<unknown> };
    assert.deepEqual(json.operations, []);
  });
});

describe("GET /api/patients/[id]/operations/[operationId]", () => {
  it("returns 404 when operation does not exist", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildOperationDeps(store);
    const response = await handleGetOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-missing"),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-missing" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("returns 404 when operation belongs to another patient", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1", "pat-2"] };
    store.operations.set("op-1", createOp({ id: "op-1", patientId: "pat-2" }));
    const deps = buildOperationDeps(store);
    const response = await handleGetOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1"),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("returns 200 with the operation detail", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({ id: "op-1", patientId: "pat-1", garmentType: "Media corta" }));
    const deps = buildOperationDeps(store);
    const response = await handleGetOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1"),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { id: string; garmentType: string };
    assert.equal(json.id, "op-1");
    assert.equal(json.garmentType, "Media corta");
  });
});

describe("PATCH /api/patients/[id]/operations/[operationId]", () => {
  it("returns 400 when no fields to update", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 400 for invalid status value", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 404 when operation does not exist", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/missing", {
        method: "PATCH",
        body: JSON.stringify({ status: "CONFIRMADO" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "missing" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("updates status successfully", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({ id: "op-1", patientId: "pat-1", status: "PRESUPUESTO" }));
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "CONFIRMADO" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { status: string };
    assert.equal(json.status, "CONFIRMADO");
  });

  it("updates multiple fields at once", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({ id: "op-1", patientId: "pat-1", garmentType: "Vieja" }));
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1", {
        method: "PATCH",
        body: JSON.stringify({ garmentType: "Nueva prenda", notes: "Actualizado" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { garmentType: string; notes: string };
    assert.equal(json.garmentType, "Nueva prenda");
    assert.equal(json.notes, "Actualizado");
  });

  it("returns 400 when updating a CANCELADO operation", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({ id: "op-1", patientId: "pat-1", status: "CANCELADO" }));
    const deps = buildOperationDeps(store);
    const response = await handleUpdateOperationRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "ENTREGADO" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });
});

describe("POST /api/patients/[id]/operations/[operationId]/deposit", () => {
  it("returns 400 when amount is missing", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1/deposit", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 400 when amount is zero or negative", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: "0" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 404 when operation does not exist", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/missing/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: "50000" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "missing" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 404);
  });

  it("adds deposit and returns updated operation", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({
      id: "op-1", patientId: "pat-1",
      totalAmount: newDecimal(100000),
      depositPaid: newDecimal(30000),
    }));
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: "50000" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 200);
    const json = (await response.json()) as { depositPaid: { toString: () => string } };
    assert.equal(json.depositPaid.toString(), "80000");
  });

  it("returns 400 when deposit exceeds total", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({
      id: "op-1", patientId: "pat-1",
      totalAmount: newDecimal(100000),
      depositPaid: newDecimal(70000),
    }));
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: "40000" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });

  it("returns 400 when adding deposit to CANCELADO operation", async () => {
    const store = { operations: new Map<string, MockOperation>(), knownPatientIds: ["pat-1"] };
    store.operations.set("op-1", createOp({
      id: "op-1", patientId: "pat-1",
      status: "CANCELADO",
      totalAmount: newDecimal(100000),
      depositPaid: newDecimal(0),
    }));
    const deps = buildDepositDeps(store);
    const response = await handleAddDepositRequest(
      buildRequest("http://localhost/api/patients/pat-1/operations/op-1/deposit", {
        method: "POST",
        body: JSON.stringify({ amount: "50000" }),
      }),
      { params: Promise.resolve({ id: "pat-1", operationId: "op-1" }) },
      staffUser,
      deps,
    );
    assert.equal(response.status, 400);
  });
});
