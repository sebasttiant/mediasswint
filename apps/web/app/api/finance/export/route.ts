import { NextResponse } from "next/server";

import { isPaymentMethod, resolveCashboxRange } from "@/lib/cashbox";
import {
  fetchCashCountDetail,
  fetchDailyCashbox,
  fetchExpenseDetail,
  fetchPaymentMovements,
  toCashboxDateKeyForForm,
} from "@/lib/finance";
import { buildCashboxReportModel } from "@/lib/finance-report";
import { cashboxReportToXlsx } from "@/lib/finance-xlsx";
import { withAuth } from "@/lib/with-auth";

// ExcelJS/PDFKit need the Node runtime (Buffer / streams); they cannot run on the edge.
export const runtime = "nodejs";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_CONTENT_TYPE = "application/pdf";

const EXPORT_FORMATS = {
  PDF: "pdf",
  XLSX: "xlsx",
} as const;

type ExportFormat = (typeof EXPORT_FORMATS)[keyof typeof EXPORT_FORMATS];

export type ExportDeps = {
  fetchDailyCashbox: typeof fetchDailyCashbox;
  fetchPaymentMovements: typeof fetchPaymentMovements;
  fetchExpenseDetail: typeof fetchExpenseDetail;
  fetchCashCountDetail: typeof fetchCashCountDetail;
  now: () => Date;
};

const defaultDeps: ExportDeps = {
  fetchDailyCashbox,
  fetchPaymentMovements,
  fetchExpenseDetail,
  fetchCashCountDetail,
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

  const format = (params.get("format") ?? EXPORT_FORMATS.XLSX).toLowerCase();
  if (!isExportFormat(format)) {
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

  // The audit detail (expenses, cash counts) is narrowed by the date range ONLY, exactly
  // like the daily reconciliation — method/search never reach it. Only the movement
  // detail is filtered by method/patient.
  const [rows, movements, expenses, cashCounts] = await Promise.all([
    deps.fetchDailyCashbox({ from: range.from, to: range.to }),
    deps.fetchPaymentMovements({ from: range.from, to: range.to, method, search }),
    deps.fetchExpenseDetail({ from: range.from, to: range.to }),
    deps.fetchCashCountDetail({ from: range.from, to: range.to }),
  ]);

  const model = buildCashboxReportModel({
    range,
    rows,
    movements,
    expenses,
    cashCounts,
    method,
    search,
    generatedAt: now,
  });
  const extension = format === EXPORT_FORMATS.PDF ? "pdf" : "xlsx";
  const contentType = format === EXPORT_FORMATS.PDF ? PDF_CONTENT_TYPE : XLSX_CONTENT_TYPE;
  const bytes =
    format === EXPORT_FORMATS.PDF
      ? await renderPdf(model)
      : await cashboxReportToXlsx(model);

  const filename = `caja_${range.from}_${range.to}.${extension}`;
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function isExportFormat(format: string): format is ExportFormat {
  return format === EXPORT_FORMATS.XLSX || format === EXPORT_FORMATS.PDF;
}

async function renderPdf(model: Parameters<typeof cashboxReportToXlsx>[0]) {
  // Keep PDFKit off the XLSX path and out of any client import graph.
  const { cashboxReportToPdf } = await import("@/lib/finance-pdf");
  return cashboxReportToPdf(model);
}

export const GET = withAuth(async (request) => handleCashboxExportRequest(request));
