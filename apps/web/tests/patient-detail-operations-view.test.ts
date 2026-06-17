import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OperationSummary } from "../app/patients/[id]/patient-detail-helpers";
import {
  buildCommercialSummary,
  buildOperationFinancials,
} from "../app/patients/[id]/patient-detail-view";

function operationFixture(overrides: Partial<OperationSummary> = {}): OperationSummary {
  return {
    id: "op-1",
    status: "PRESUPUESTO",
    totalAmount: "100000",
    depositPaid: "0",
    garmentType: "Media",
    notes: null,
    orderNumber: null,
    orderedAt: null,
    productCode: null,
    productType: null,
    quantity: null,
    invoiceNumber: null,
    invoiceDate: null,
    discount: null,
    exitDate: null,
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-02-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildOperationFinancials", () => {
  it("computes pending balance as total minus deposit", () => {
    const f = buildOperationFinancials(operationFixture({ totalAmount: "100000", depositPaid: "30000" }));
    assert.equal(f.total, 100000);
    assert.equal(f.deposit, 30000);
    assert.equal(f.pendingBalance, 70000);
    assert.equal(f.hasTotal, true);
    assert.equal(f.isFullyPaid, false);
  });

  it("never returns a negative pending balance", () => {
    const f = buildOperationFinancials(operationFixture({ totalAmount: "100000", depositPaid: "120000" }));
    assert.equal(f.pendingBalance, 0);
    assert.equal(f.isFullyPaid, true);
  });

  it("treats a null total as no total and allows deposits", () => {
    const f = buildOperationFinancials(operationFixture({ totalAmount: null, depositPaid: "50000" }));
    assert.equal(f.total, 0);
    assert.equal(f.hasTotal, false);
    assert.equal(f.pendingBalance, 0);
    assert.equal(f.canDeposit, true);
  });

  it("disables edit and deposit for CANCELADO operations", () => {
    const f = buildOperationFinancials(operationFixture({ status: "CANCELADO" }));
    assert.equal(f.isCancelled, true);
    assert.equal(f.canEdit, false);
    assert.equal(f.canDeposit, false);
  });

  it("disables deposit when the balance is fully paid but keeps edit enabled", () => {
    const f = buildOperationFinancials(operationFixture({ totalAmount: "100000", depositPaid: "100000" }));
    assert.equal(f.isFullyPaid, true);
    assert.equal(f.canDeposit, false);
    assert.equal(f.canEdit, true);
  });

  it("allows edit and deposit for an active operation with pending balance", () => {
    const f = buildOperationFinancials(operationFixture({ status: "CONFIRMADO", totalAmount: "100000", depositPaid: "40000" }));
    assert.equal(f.canEdit, true);
    assert.equal(f.canDeposit, true);
  });
});

describe("buildCommercialSummary", () => {
  it("aggregates totals excluding CANCELADO operations", () => {
    const summary = buildCommercialSummary([
      operationFixture({ id: "a", totalAmount: "100000", depositPaid: "30000" }),
      operationFixture({ id: "b", totalAmount: "50000", depositPaid: "50000" }),
      operationFixture({ id: "c", status: "CANCELADO", totalAmount: "999999", depositPaid: "0" }),
    ]);

    assert.equal(summary.totalCount, 2);
    assert.equal(summary.totalAmount, 150000);
    assert.equal(summary.totalDeposit, 80000);
    assert.equal(summary.totalBalance, 70000);
  });

  it("never lets the aggregate balance go negative from overpaid operations", () => {
    const summary = buildCommercialSummary([
      operationFixture({ id: "a", totalAmount: "100000", depositPaid: "150000" }),
    ]);

    assert.equal(summary.totalBalance, 0);
  });

  it("returns zeroed totals for an empty list", () => {
    const summary = buildCommercialSummary([]);
    assert.deepEqual(summary, { totalCount: 0, totalAmount: 0, totalDeposit: 0, totalBalance: 0 });
  });
});
