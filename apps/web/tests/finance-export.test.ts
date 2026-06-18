import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { handleCashboxExportRequest, type ExportDeps } from "@/app/api/finance/export/route";
import { buildDailyCashbox, type DailyCashboxRow, type PaymentMovementDetail } from "@/lib/cashbox";

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

function makeDeps(): {
  deps: ExportDeps;
  calls: { daily?: { from?: string; to?: string }; movement?: Record<string, unknown> };
} {
  const calls: { daily?: { from?: string; to?: string }; movement?: Record<string, unknown> } = {};
  const deps: ExportDeps = {
    fetchDailyCashbox: async (options) => {
      calls.daily = options;
      return sampleRows;
    },
    fetchPaymentMovements: async (filters) => {
      calls.movement = filters as unknown as Record<string, unknown>;
      return sampleMovements;
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
