import { NextResponse } from "next/server";

import { isPaymentMethod, resolveCashboxRange } from "@/lib/cashbox";
import {
  fetchDailyCashbox,
  fetchPaymentMovements,
  toCashboxDateKeyForForm,
} from "@/lib/finance";
import { buildCashboxReportModel } from "@/lib/finance-report";
import { cashboxReportToXlsx } from "@/lib/finance-xlsx";
import { withAuth } from "@/lib/with-auth";

// ExcelJS needs the Node runtime (Buffer / streams); it cannot run on the edge.
export const runtime = "nodejs";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ExportDeps = {
  fetchDailyCashbox: typeof fetchDailyCashbox;
  fetchPaymentMovements: typeof fetchPaymentMovements;
  now: () => Date;
};

const defaultDeps: ExportDeps = {
  fetchDailyCashbox,
  fetchPaymentMovements,
  now: () => new Date(),
};

/**
 * Export the cashbox report for exactly the filtered view. The query params mirror
 * the screen (from/to drive the daily summary; method/search narrow the movement
 * detail only), and the route reuses the same fetchers + report model, so the file
 * can never disagree with what the user filtered on screen.
 */
export async function handleCashboxExportRequest(
  request: Request,
  deps: ExportDeps = defaultDeps,
): Promise<Response> {
  const params = new URL(request.url).searchParams;

  const format = (params.get("format") ?? "xlsx").toLowerCase();
  if (format !== "xlsx") {
    return NextResponse.json(
      { error: `Unsupported export format: ${format}` },
      { status: 400 },
    );
  }

  const now = deps.now();
  const today = toCashboxDateKeyForForm(now);
  const range = resolveCashboxRange(
    { from: params.get("from"), to: params.get("to") },
    today,
  );
  const methodParam = params.get("method");
  const method = isPaymentMethod(methodParam) ? methodParam : undefined;
  const search = params.get("search")?.trim() || undefined;

  const [rows, movements] = await Promise.all([
    deps.fetchDailyCashbox({ from: range.from, to: range.to }),
    deps.fetchPaymentMovements({ from: range.from, to: range.to, method, search }),
  ]);

  const model = buildCashboxReportModel({
    range,
    rows,
    movements,
    method,
    search,
    generatedAt: now,
  });
  const bytes = await cashboxReportToXlsx(model);

  const filename = `caja_${range.from}_${range.to}.xlsx`;
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withAuth(async (request) => handleCashboxExportRequest(request));
