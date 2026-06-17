import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import {
  addDeposit,
  buildOperationalPendingQueue,
  getOperationPendingBalance,
  isValidOperationMetadataUpdate,
  isValidOperationPaymentUpdate,
  isValidPaymentMovementInput,
  normalizePaymentBank,
  type AddDepositPaymentInput,
  type OperationalQueueSourceOperation,
  type ServiceResult,
  type ServiceErrorCode,
  updateOperation,
} from "@/lib/operations";
import { toAuditPayload } from "@/lib/audit-log";

type OkResult<T> = { ok: true; value: T };
type ErrResult = { ok: false; error: ServiceErrorCode };

function isOk<T>(result: ServiceResult<T>): result is OkResult<T> {
  return result.ok;
}

function isErr<T>(result: ServiceResult<T>): result is ErrResult {
  return !result.ok;
}

describe("ServiceResult type utilities", () => {
  it("discriminates ok result", () => {
    const result: ServiceResult<string> = { ok: true, value: "ok" };
    assert.equal(isOk(result), true);
    assert.equal(isErr(result), false);
  });

  it("discriminates error result", () => {
    const result: ServiceResult<string> = { ok: false, error: "NOT_FOUND" };
    assert.equal(isErr(result), true);
    assert.equal(isOk(result), false);
  });

  it("narrows ok value access", () => {
    const result: ServiceResult<number> = { ok: true, value: 42 };
    if (isOk(result)) {
      assert.equal(result.value, 42);
    }
  });

  it("narrows error code access", () => {
    const result: ServiceResult<never> = { ok: false, error: "FORBIDDEN" };
    if (isErr(result)) {
      assert.equal(result.error, "FORBIDDEN");
    }
  });
});

describe("ServiceErrorCode exhaustiveness", () => {
  const errorCodes: ServiceErrorCode[] = ["NOT_FOUND", "INVALID_OPERATION", "FORBIDDEN", "UNKNOWN"];

  it("has all expected error codes", () => {
    assert.equal(errorCodes.length, 4);
    assert.ok(errorCodes.includes("NOT_FOUND"));
    assert.ok(errorCodes.includes("INVALID_OPERATION"));
    assert.ok(errorCodes.includes("FORBIDDEN"));
    assert.ok(errorCodes.includes("UNKNOWN"));
  });
});

function createOperation(overrides: Partial<OperationalQueueSourceOperation>): OperationalQueueSourceOperation {
  return {
    id: "op_1",
    status: "PRESUPUESTO",
    garmentType: "Media",
    totalAmount: "100000",
    depositPaid: "0",
    patientName: "Ada Lovelace",
    patientId: "pat_1",
    createdAt: new Date("2026-05-20T10:00:00Z"),
    updatedAt: new Date("2026-05-20T10:00:00Z"),
    ...overrides,
  };
}

function getGlobalPrisma(): unknown {
  return (globalThis as unknown as { prisma?: unknown }).prisma;
}

function setGlobalPrisma(prisma: unknown): void {
  (globalThis as unknown as { prisma?: unknown }).prisma = prisma;
}

function createPersistedOperation(overrides: Record<string, unknown>) {
  return {
    id: "op_1",
    patientId: "pat_1",
    status: "PRESUPUESTO",
    totalAmount: new Prisma.Decimal(100),
    depositPaid: new Prisma.Decimal(0),
    garmentType: "Media",
    notes: null,
    orderNumber: null,
    orderedAt: null,
    productCode: null,
    productType: null,
    quantity: 1,
    invoiceNumber: null,
    invoiceDate: null,
    discount: null,
    exitDate: null,
    createdAt: new Date("2026-05-20T10:00:00Z"),
    updatedAt: new Date("2026-05-20T10:00:00Z"),
    patient: { id: "pat_1", fullName: "Ada Lovelace" },
    ...overrides,
  };
}

describe("getOperationPendingBalance", () => {
  it("returns the positive difference between total and deposit", () => {
    const balance = getOperationPendingBalance(createOperation({ totalAmount: "200000", depositPaid: "50000" }));

    assert.equal(balance, 150000);
  });

  it("never returns a negative balance", () => {
    const balance = getOperationPendingBalance(createOperation({ totalAmount: "100000", depositPaid: "120000" }));

    assert.equal(balance, 0);
  });
});

describe("isValidOperationPaymentUpdate", () => {
  it("rejects lowering totalAmount below the already paid deposit", () => {
    const isValid = isValidOperationPaymentUpdate(
      { totalAmount: new Prisma.Decimal(100000), depositPaid: new Prisma.Decimal(80000) },
      { totalAmount: new Prisma.Decimal(70000) },
    );

    assert.equal(isValid, false);
  });

  it("rejects simultaneous updates where final deposit exceeds final total", () => {
    const isValid = isValidOperationPaymentUpdate(
      { totalAmount: new Prisma.Decimal(100000), depositPaid: new Prisma.Decimal(20000) },
      { totalAmount: new Prisma.Decimal(60000), depositPaid: new Prisma.Decimal(70000) },
    );

    assert.equal(isValid, false);
  });

  it("accepts lowering totalAmount when it still covers the effective deposit", () => {
    const isValid = isValidOperationPaymentUpdate(
      { totalAmount: new Prisma.Decimal(100000), depositPaid: new Prisma.Decimal(50000) },
      { totalAmount: new Prisma.Decimal(70000) },
    );

    assert.equal(isValid, true);
  });
});

describe("isValidOperationMetadataUpdate", () => {
  it("rejects quantity below 1", () => {
    assert.equal(isValidOperationMetadataUpdate(null, { quantity: 0 }), false);
  });

  it("rejects a non-integer quantity", () => {
    assert.equal(isValidOperationMetadataUpdate(null, { quantity: 1.5 }), false);
  });

  it("rejects a negative discount", () => {
    assert.equal(isValidOperationMetadataUpdate(null, { discount: new Prisma.Decimal(-1) }), false);
  });

  it("rejects discount exceeding the total in the same input", () => {
    assert.equal(
      isValidOperationMetadataUpdate(null, {
        discount: new Prisma.Decimal(150),
        totalAmount: new Prisma.Decimal(100),
      }),
      false,
    );
  });

  it("rejects discount exceeding the existing total", () => {
    assert.equal(
      isValidOperationMetadataUpdate(
        { totalAmount: new Prisma.Decimal(100), discount: null, orderedAt: null, exitDate: null },
        { discount: new Prisma.Decimal(150) },
      ),
      false,
    );
  });

  it("rejects existing discount exceeding a new effective total", () => {
    assert.equal(
      isValidOperationMetadataUpdate(
        { totalAmount: new Prisma.Decimal(200), discount: new Prisma.Decimal(150), orderedAt: null, exitDate: null },
        { totalAmount: new Prisma.Decimal(100) },
      ),
      false,
    );
  });

  it("rejects exitDate earlier than orderedAt in the same input", () => {
    assert.equal(
      isValidOperationMetadataUpdate(null, {
        orderedAt: new Date("2026-02-10T00:00:00Z"),
        exitDate: new Date("2026-02-01T00:00:00Z"),
      }),
      false,
    );
  });

  it("rejects exitDate earlier than the existing orderedAt", () => {
    assert.equal(
      isValidOperationMetadataUpdate(
        { totalAmount: null, discount: null, orderedAt: new Date("2026-02-10T00:00:00Z"), exitDate: null },
        { exitDate: new Date("2026-02-01T00:00:00Z") },
      ),
      false,
    );
  });

  it("accepts valid metadata", () => {
    assert.equal(
      isValidOperationMetadataUpdate(null, {
        quantity: 2,
        discount: new Prisma.Decimal(50),
        totalAmount: new Prisma.Decimal(100),
        orderedAt: new Date("2026-02-01T00:00:00Z"),
        exitDate: new Date("2026-02-10T00:00:00Z"),
      }),
      true,
    );
  });

  it("accepts an empty update", () => {
    assert.equal(isValidOperationMetadataUpdate(null, {}), true);
  });
});

describe("updateOperation business rules", () => {
  it("rejects metadata-only updates on an existing CANCELADO operation", async () => {
    const originalPrisma = getGlobalPrisma();
    let updateCalls = 0;
    setGlobalPrisma({
      commercialOperation: {
        findFirst: async () => createPersistedOperation({ status: "CANCELADO" }),
        update: async () => {
          updateCalls += 1;
          return createPersistedOperation({ status: "CANCELADO" });
        },
      },
    });

    try {
      const result = await updateOperation("pat_1", "op_1", { orderNumber: "3952" });

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "INVALID_OPERATION");
      assert.equal(updateCalls, 0);
    } finally {
      setGlobalPrisma(originalPrisma);
    }
  });

  it("rejects lowering totalAmount below the existing discount", async () => {
    const originalPrisma = getGlobalPrisma();
    let updateCalls = 0;
    setGlobalPrisma({
      commercialOperation: {
        findFirst: async () => createPersistedOperation({
          totalAmount: new Prisma.Decimal(200),
          discount: new Prisma.Decimal(150),
        }),
        update: async () => {
          updateCalls += 1;
          return createPersistedOperation({});
        },
      },
    });

    try {
      const result = await updateOperation("pat_1", "op_1", { totalAmount: new Prisma.Decimal(100) });

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "INVALID_OPERATION");
      assert.equal(updateCalls, 0);
    } finally {
      setGlobalPrisma(originalPrisma);
    }
  });
});

describe("toAuditPayload order metadata", () => {
  it("serializes new metadata fields (dates as ISO, decimals as strings)", () => {
    const payload = toAuditPayload({
      id: "op_1",
      orderNumber: "3952",
      quantity: 2,
      discount: new Prisma.Decimal(5000),
      orderedAt: new Date("2026-02-01T00:00:00Z"),
      exitDate: new Date("2026-02-10T00:00:00Z"),
      productCode: "MR",
    });

    assert.ok(payload);
    assert.equal(payload.orderNumber, "3952");
    assert.equal(payload.quantity, 2);
    assert.equal(payload.discount, "5000");
    assert.equal(payload.orderedAt, "2026-02-01T00:00:00.000Z");
    assert.equal(payload.exitDate, "2026-02-10T00:00:00.000Z");
    assert.equal(payload.productCode, "MR");
  });
});

describe("buildOperationalPendingQueue", () => {
  it("groups payment and production work by current operation statuses", () => {
    const queue = buildOperationalPendingQueue(
      [
        createOperation({
          id: "op_payment",
          status: "PRESUPUESTO",
          totalAmount: "200000",
          depositPaid: "50000",
          updatedAt: new Date("2026-05-20T10:00:00Z"),
        }),
        createOperation({
          id: "op_confirmed",
          status: "CONFIRMADO",
          totalAmount: "120000",
          depositPaid: "120000",
          patientId: "pat_2",
          updatedAt: new Date("2026-05-20T12:00:00Z"),
        }),
        createOperation({
          id: "op_production_with_balance",
          status: "EN_PRODUCCION",
          totalAmount: "90000",
          depositPaid: "10000",
          patientId: "pat_3",
          updatedAt: new Date("2026-05-20T11:00:00Z"),
        }),
      ],
      10,
    );

    assert.equal(queue.paymentCount, 2);
    assert.equal(queue.productionCount, 2);
    assert.deepEqual(
      queue.paymentItems.map((item) => item.id),
      ["op_production_with_balance", "op_payment"],
    );
    assert.deepEqual(
      queue.productionItems.map((item) => item.id),
      ["op_confirmed", "op_production_with_balance"],
    );
    assert.equal(queue.paymentItems[0]!.actionHref, "/patients/pat_3");
  });

  it("excludes cancelled, delivered, and fully paid operations from the wrong queues", () => {
    const queue = buildOperationalPendingQueue(
      [
        createOperation({ id: "op_cancelled", status: "CANCELADO", totalAmount: "100000", depositPaid: "0" }),
        createOperation({ id: "op_delivered", status: "ENTREGADO", totalAmount: "100000", depositPaid: "100000" }),
        createOperation({ id: "op_paid", status: "PRESUPUESTO", totalAmount: "100000", depositPaid: "100000" }),
      ],
      10,
    );

    assert.equal(queue.paymentCount, 0);
    assert.equal(queue.productionCount, 0);
    assert.deepEqual(queue.paymentItems, []);
    assert.deepEqual(queue.productionItems, []);
  });

  it("limits visible items without losing queue counts", () => {
    const queue = buildOperationalPendingQueue(
      [
        createOperation({ id: "op_1", status: "CONFIRMADO", totalAmount: "100000", depositPaid: "0" }),
        createOperation({ id: "op_2", status: "CONFIRMADO", totalAmount: "100000", depositPaid: "0" }),
      ],
      1,
    );

    assert.equal(queue.paymentCount, 2);
    assert.equal(queue.productionCount, 2);
    assert.equal(queue.paymentItems.length, 1);
    assert.equal(queue.productionItems.length, 1);
  });
});

describe("isValidPaymentMovementInput", () => {
  it("accepts a valid method + income type", () => {
    assert.equal(
      isValidPaymentMovementInput({ method: "EFECTIVO", incomeType: "PRIMERA_VEZ" }),
      true,
    );
  });

  it("accepts a transfer with a known bank", () => {
    assert.equal(
      isValidPaymentMovementInput({
        method: "TRANSFERENCIA",
        bank: "BANCOLOMBIA",
        incomeType: "R",
      }),
      true,
    );
  });

  it("rejects an unknown method", () => {
    assert.equal(
      isValidPaymentMovementInput({
        method: "PAYPAL" as unknown as AddDepositPaymentInput["method"],
        incomeType: "PRIMERA_VEZ",
      }),
      false,
    );
  });

  it("rejects an unknown income type", () => {
    assert.equal(
      isValidPaymentMovementInput({
        method: "EFECTIVO",
        incomeType: "DESCONOCIDO" as unknown as AddDepositPaymentInput["incomeType"],
      }),
      false,
    );
  });

  it("rejects an unknown bank", () => {
    assert.equal(
      isValidPaymentMovementInput({
        method: "TRANSFERENCIA",
        bank: "BANCO_PICHINCHA" as unknown as AddDepositPaymentInput["bank"],
        incomeType: "PRIMERA_VEZ",
      }),
      false,
    );
  });
});

describe("normalizePaymentBank", () => {
  it("keeps the bank for transfers", () => {
    assert.equal(normalizePaymentBank("TRANSFERENCIA", "NEQUI"), "NEQUI");
  });

  it("clears the bank for non-transfer methods", () => {
    assert.equal(normalizePaymentBank("EFECTIVO", "NEQUI"), null);
    assert.equal(normalizePaymentBank("TARJETA_DEBITO", "BANCOLOMBIA"), null);
  });

  it("returns null for a transfer without a bank", () => {
    assert.equal(normalizePaymentBank("TRANSFERENCIA", null), null);
    assert.equal(normalizePaymentBank("TRANSFERENCIA"), null);
  });
});

describe("addDeposit ledger movement", () => {
  it("creates one payment movement inside the same transaction as the deposit", async () => {
    const originalPrisma = getGlobalPrisma();
    const movementCreates: Array<Record<string, unknown>> = [];

    const txMock = {
      commercialOperation: {
        findFirst: async () => createPersistedOperation({ depositPaid: new Prisma.Decimal(0) }),
        update: async () => createPersistedOperation({ depositPaid: new Prisma.Decimal(100) }),
      },
      paymentMovement: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          movementCreates.push(data);
          return data;
        },
      },
    };

    setGlobalPrisma({
      $transaction: async (fn: (tx: typeof txMock) => unknown) => fn(txMock),
      auditLog: { create: async () => ({}) },
    });

    try {
      const result = await addDeposit("pat_1", "op_1", new Prisma.Decimal(100), {
        method: "TRANSFERENCIA",
        bank: "BANCOLOMBIA",
        incomeType: "R",
      });

      assert.equal(result.ok, true);
      assert.equal(movementCreates.length, 1);
      assert.equal(movementCreates[0].method, "TRANSFERENCIA");
      assert.equal(movementCreates[0].bank, "BANCOLOMBIA");
      assert.equal(movementCreates[0].incomeType, "R");
      assert.equal(String(movementCreates[0].amount), "100");
    } finally {
      setGlobalPrisma(originalPrisma);
    }
  });

  it("rejects a zero amount without opening a transaction or creating a movement", async () => {
    const originalPrisma = getGlobalPrisma();
    let transactionCalls = 0;
    setGlobalPrisma({
      $transaction: async () => {
        transactionCalls += 1;
        return { ok: false };
      },
    });

    try {
      const result = await addDeposit("pat_1", "op_1", new Prisma.Decimal(0), {
        method: "EFECTIVO",
        incomeType: "PRIMERA_VEZ",
      });

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "INVALID_OPERATION");
      assert.equal(transactionCalls, 0);
    } finally {
      setGlobalPrisma(originalPrisma);
    }
  });

  it("rejects an invalid payment method without writing anything", async () => {
    const originalPrisma = getGlobalPrisma();
    let transactionCalls = 0;
    setGlobalPrisma({
      $transaction: async () => {
        transactionCalls += 1;
        return { ok: false };
      },
    });

    try {
      const result = await addDeposit("pat_1", "op_1", new Prisma.Decimal(100), {
        method: "BITCOIN" as unknown as AddDepositPaymentInput["method"],
        incomeType: "PRIMERA_VEZ",
      });

      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, "INVALID_OPERATION");
      assert.equal(transactionCalls, 0);
    } finally {
      setGlobalPrisma(originalPrisma);
    }
  });
});
