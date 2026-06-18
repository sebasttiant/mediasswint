import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";

import { handleCashboxExportRequest, type ExportDeps } from "@/app/api/finance/export/route";
import {
  buildDailyCashbox,
  type CashCountDetail,
  type DailyCashboxRow,
  type ExpenseDetail,
  type PaymentMovementDetail,
} from "@/lib/cashbox";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

const sampleRows: DailyCashboxRow[] = buildDailyCashbox(
  [{ amount: 1000, method: "EFECTIVO", incomeType: "PRIMERA_VEZ", dateKey: "2026-06-17" }],
  [],
  [],
);

const sampleMovements: PaymentMovementDetail[] = [
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

const sampleExpenses: ExpenseDetail[] = [
  { id: "e1", dateKey: "2026-06-17", amount: 24000, concept: "Pago proveedor", note: "factura 123" },
];

const sampleCashCounts: CashCountDetail[] = [
  {
    dateKey: "2026-06-17",
    countedAmount: 920000,
    note: "Conteo de cierre",
    updatedAt: "2026-06-17T22:10:00Z",
  },
];

type ExportCalls = {
  daily?: { from?: string; to?: string };
  movement?: Record<string, unknown>;
  expense?: { from?: string; to?: string };
  count?: { from?: string; to?: string };
};

function makeDeps(): { deps: ExportDeps; calls: ExportCalls } {
  const calls: ExportCalls = {};
  const deps: ExportDeps = {
    fetchDailyCashbox: async (options) => {
      calls.daily = options;
      return sampleRows;
    },
    fetchPaymentMovements: async (filters) => {
      calls.movement = filters as unknown as Record<string, unknown>;
      return sampleMovements;
    },
    fetchExpenseDetail: async (range) => {
      calls.expense = range;
      return sampleExpenses;
    },
    fetchCashCountDetail: async (range) => {
      calls.count = range;
      return sampleCashCounts;
    },
    now: () => new Date("2026-06-17T15:00:00Z"),
  };
  return { deps, calls };
}

describe("handleCashboxExportRequest", () => {
  it("returns an .xlsx attachment named after the resolved range", async () => {
    const { deps } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17&format=xlsx",
    );

    const res = await handleCashboxExportRequest(request, deps);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), XLSX_CONTENT_TYPE);
    assert.match(
      res.headers.get("content-disposition") ?? "",
      /caja_2026-06-16_2026-06-17\.xlsx/,
    );

    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.ok(bytes.length > 0);
    // .xlsx is a ZIP container; it must start with the "PK" local file header.
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const summary = wb.getWorksheet("Resumen");
    const movements = wb.getWorksheet("Movimientos");
    const audit = wb.getWorksheet("Auditoría");
    assert.ok(summary);
    assert.ok(movements);
    assert.ok(audit, "expected an Auditoría sheet with the expense / cash-count breakdown");
    assert.equal(summary.views[0]?.state, "frozen");
    assert.equal(movements.views[0]?.state, "frozen");
    assert.equal(summary.getCell("A1").value, "Caja y Finanzas - Reporte");
    assert.equal(summary.getCell("B18").fill.type, "pattern");
    assert.equal(movements.getColumn(7).width, 52);

    // Freeze panes: the summary keeps the title row + Fecha column pinned; the movements
    // sheet pins through the column header (row 4) so data scrolls under live headers.
    assert.equal(summary.views[0]?.xSplit, 1);
    assert.equal(summary.views[0]?.ySplit, 1);
    assert.equal(movements.views[0]?.xSplit, 1);
    assert.equal(movements.views[0]?.ySplit, 4);

    // The grouped header row ("Abonos", ...) must be immediately followed by the real
    // header row ("1 Vez", ...) with no phantom blank row wedged between them.
    let groupRowNumber = 0;
    summary.eachRow((row, n) => {
      if (row.getCell(2).value === "Abonos" && groupRowNumber === 0) groupRowNumber = n;
    });
    assert.ok(groupRowNumber > 0, "could not locate the grouped header row");
    assert.equal(summary.getRow(groupRowNumber + 1).getCell(2).value, "1 Vez");
    assert.equal(summary.getRow(groupRowNumber + 1).getCell(5).value, "Total Abonos");

    // The audit sheet must carry the line-item detail behind the daily totals: the
    // expense concept/amount and the counted-cash record.
    const auditCells = new Set<unknown>();
    audit.eachRow((row) => row.eachCell((cell) => auditCells.add(cell.value)));
    assert.ok(auditCells.has("Pago proveedor"), "expense concept missing from audit sheet");
    assert.ok(auditCells.has(24000), "expense amount missing from audit sheet");
    assert.ok(auditCells.has(920000), "counted cash missing from audit sheet");
    assert.ok(auditCells.has("Conteo de cierre"), "cash-count note missing from audit sheet");
  });

  it("returns a .pdf attachment named after the resolved range", async () => {
    const { deps } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17&format=pdf",
    );

    const res = await handleCashboxExportRequest(request, deps);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), PDF_CONTENT_TYPE);
    assert.match(
      res.headers.get("content-disposition") ?? "",
      /caja_2026-06-16_2026-06-17\.pdf/,
    );

    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.ok(bytes.length > 0);
    assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  });

  it("never passes method/search to the daily summary, only to the movement detail", async () => {
    const { deps, calls } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17&method=EFECTIVO&search=Juan",
    );

    await handleCashboxExportRequest(request, deps);

    // The reconciliation must stay whole: only the date range reaches it.
    assert.deepEqual(calls.daily, { from: "2026-06-16", to: "2026-06-17" });
    // The audit detail (expenses, cash counts) is narrowed by date range ONLY — the
    // method/patient filters must never reach it, exactly like the reconciliation.
    assert.deepEqual(calls.expense, { from: "2026-06-16", to: "2026-06-17" });
    assert.deepEqual(calls.count, { from: "2026-06-16", to: "2026-06-17" });
    // The detail gets the method/patient filters.
    assert.equal(calls.movement?.method, "EFECTIVO");
    assert.equal(calls.movement?.search, "Juan");
  });

  it("passes no method/search to the detail when those params are absent", async () => {
    const { deps, calls } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17",
    );

    await handleCashboxExportRequest(request, deps);

    // A missing filter must stay undefined, never silently become a different value
    // that would over- or under-populate the movement sheet.
    assert.equal(calls.movement?.method, undefined);
    assert.equal(calls.movement?.search, undefined);
  });

  it("drops an invalid method instead of erroring", async () => {
    const { deps, calls } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17&method=CHEQUE",
    );

    const res = await handleCashboxExportRequest(request, deps);

    assert.equal(res.status, 200);
    assert.equal(calls.movement?.method, undefined);
  });

  it("rejects an unsupported format with 400", async () => {
    const { deps } = makeDeps();
    const request = new Request(
      "http://localhost/api/finance/export?from=2026-06-16&to=2026-06-17&format=csv",
    );

    const res = await handleCashboxExportRequest(request, deps);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: "Unsupported export format: csv" });
  });
});
