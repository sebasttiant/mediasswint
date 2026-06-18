import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDailyCashbox, type PaymentMovementDetail } from "@/lib/cashbox";
import { buildCashboxReportModel } from "@/lib/finance-report";

// Two realistic days built through the real aggregator so the report is tested
// against the same numbers the screen shows.
const rows = buildDailyCashbox(
  [
    { amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ", dateKey: "2026-06-17" },
    { amount: 300, method: "TRANSFERENCIA", incomeType: "R", dateKey: "2026-06-17" },
    { amount: 500, method: "EFECTIVO", incomeType: "PRIMERA_VEZ", dateKey: "2026-06-16" },
  ],
  [{ amount: 100, dateKey: "2026-06-17" }],
  [{ amount: 920, dateKey: "2026-06-17" }],
);

const movements: PaymentMovementDetail[] = [
  {
    id: "m1",
    dateKey: "2026-06-17",
    patientName: "Juan Perez",
    method: "EFECTIVO",
    incomeType: "PRIMERA_VEZ",
    amount: 1000,
    bank: null,
    note: null,
  },
];

const generatedAt = new Date("2026-06-17T15:30:00Z");

describe("buildCashboxReportModel — totals across the range", () => {
  const model = buildCashboxReportModel({
    range: { from: "2026-06-16", to: "2026-06-17" },
    rows,
    movements,
    method: "EFECTIVO",
    search: "   ",
    generatedAt,
  });

  it("sums the cash-chain figures over every day in the range", () => {
    assert.equal(model.totals.totalAbonos, 1800); // 1300 + 500
    assert.equal(model.totals.efectivo, 1500); // 1000 + 500
    assert.equal(model.totals.transferencias, 300);
    assert.equal(model.totals.totalBancos, 300);
    assert.equal(model.totals.ventaBruta, 1500); // 1000 + 500, equals total efectivo
    assert.equal(model.totals.egresos, 100);
    assert.equal(model.totals.ventaNetaEfectivo, 1400); // 900 + 500
  });

  it("sums nullable count/difference only over days that carry a value", () => {
    assert.equal(model.totals.realContado, 920); // only 06-17 has a count
    assert.equal(model.totals.diferencia, 20); // 920 - 900 on 06-17, 06-16 is null
  });

  it("keeps realContado and diferencia null when no day in the range was counted", () => {
    const noCount = buildCashboxReportModel({
      range: { from: "2026-06-16", to: "2026-06-16" },
      rows: buildDailyCashbox(
        [{ amount: 500, method: "EFECTIVO", incomeType: "PRIMERA_VEZ", dateKey: "2026-06-16" }],
        [],
        [],
      ),
      movements: [],
      generatedAt,
    });
    assert.equal(noCount.totals.realContado, null);
    assert.equal(noCount.totals.diferencia, null);
  });

  it("breaks totals down by payment method with labels", () => {
    const byMethod = new Map(model.totalsByMethod.map((m) => [m.method, m]));
    assert.equal(byMethod.get("EFECTIVO")?.total, 1500);
    assert.equal(byMethod.get("EFECTIVO")?.label, "Efectivo");
    assert.equal(byMethod.get("TRANSFERENCIA")?.total, 300);
    assert.equal(byMethod.get("BOLD")?.total, 0);
    assert.equal(byMethod.get("OTRO")?.total, 0);
  });

  it("carries the filtered data through and normalises meta", () => {
    assert.equal(model.daily.length, 2);
    assert.equal(model.movements.length, 1);
    assert.equal(model.meta.from, "2026-06-16");
    assert.equal(model.meta.to, "2026-06-17");
    assert.equal(model.meta.method, "EFECTIVO");
    assert.equal(model.meta.search, null); // whitespace-only search collapses to null
    assert.equal(model.meta.generatedAt, "2026-06-17T15:30:00.000Z");
  });
});
