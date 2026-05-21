import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import {
  buildOperationalPendingQueue,
  getOperationPendingBalance,
  isValidOperationPaymentUpdate,
  type OperationalQueueSourceOperation,
  type ServiceResult,
  type ServiceErrorCode,
} from "@/lib/operations";

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
