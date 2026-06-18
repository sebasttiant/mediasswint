// PDFKit serializer for the cashbox report. It consumes the already-built
// CashboxReportModel and only lays out values; all accounting logic stays in
// finance-report/buildDailyCashbox.

import { createRequire } from "node:module";

import type { DailyCashboxRow } from "@/lib/cashbox";
import type { CashboxReportModel } from "@/lib/finance-report";
import { BANK_LABELS, INCOME_TYPE_LABELS, METHOD_LABELS, formatDate } from "@/lib/finance-format";

type PDFDocumentConstructor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit/js/pdfkit.standalone.js") as PDFDocumentConstructor;

const MONEY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PAGE = {
  margin: 36,
  bottom: 756,
  width: 540,
} as const;

function formatCurrency(value: number | null): string {
  if (value === null) return "Pendiente";
  return MONEY_FORMATTER.format(value);
}

function collectPdfBytes(doc: PDFKit.PDFDocument): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    });
    doc.on("error", reject);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height <= PAGE.bottom) return;
  doc.addPage();
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 32);
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(title);
  doc.moveDown(0.3);
}

function metaLine(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text(`${label}: `, { continued: true });
  doc.font("Helvetica").fillColor("#374151").text(value);
}

function drawRow(
  doc: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  options: { header?: boolean; height?: number } = {},
): void {
  const height = options.height ?? 18;
  ensureSpace(doc, height + 2);
  const startX = PAGE.margin;
  const startY = doc.y;
  let x = startX;

  doc.font(options.header ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor("#111827");
  if (options.header) {
    doc.rect(startX, startY, widths.reduce((acc, width) => acc + width, 0), height).fill("#F3F4F6");
    doc.fillColor("#111827");
  }

  cells.forEach((cell, index) => {
    doc.text(cell, x + 3, startY + 4, {
      width: widths[index] - 6,
      height: height - 6,
      ellipsis: true,
    });
    x += widths[index];
  });

  doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(startX, startY + height).lineTo(startX + PAGE.width, startY + height).stroke();
  doc.y = startY + height;
}

function drawKeyValueTable(doc: PDFKit.PDFDocument, rows: ReadonlyArray<readonly [string, string]>): void {
  for (const [label, value] of rows) {
    drawRow(doc, [label, value], [260, 280]);
  }
}

function drawTableBodyRow(
  doc: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  headerCells: readonly string[],
): void {
  if (doc.y + 20 > PAGE.bottom) {
    doc.addPage();
    drawRow(doc, headerCells, widths, { header: true });
  }
  drawRow(doc, cells, widths);
}

const DAILY_COLUMNS: ReadonlyArray<{
  label: string;
  pick: (row: DailyCashboxRow) => string;
}> = [
  { label: "Fecha", pick: (row) => formatDate(row.date) },
  { label: "Abonos", pick: (row) => formatCurrency(row.totalAbonos) },
  { label: "Reclamados", pick: (row) => formatCurrency(row.totalReclamados) },
  { label: "Bancos", pick: (row) => formatCurrency(row.totalBancos) },
  { label: "Venta bruta", pick: (row) => formatCurrency(row.ventaBruta) },
  { label: "Egresos", pick: (row) => formatCurrency(row.egresos) },
  { label: "Venta neta", pick: (row) => formatCurrency(row.ventaNetaEfectivo) },
  { label: "Real contado", pick: (row) => formatCurrency(row.realContado) },
  { label: "Diferencia", pick: (row) => formatCurrency(row.diferencia) },
];

function drawDailyBreakdown(doc: PDFKit.PDFDocument, model: CashboxReportModel): void {
  sectionTitle(doc, "Detalle diario");
  const widths = [50, 60, 70, 60, 65, 55, 65, 60, 55];
  const headers = DAILY_COLUMNS.map((column) => column.label);
  drawRow(doc, headers, widths, { header: true });
  for (const day of model.daily) {
    drawTableBodyRow(doc, DAILY_COLUMNS.map((column) => column.pick(day)), widths, headers);
  }
}

function drawMovements(doc: PDFKit.PDFDocument, model: CashboxReportModel): void {
  sectionTitle(doc, "Detalle de movimientos");
  const widths = [46, 108, 70, 64, 56, 70, 126];
  const headers = ["Fecha", "Paciente", "Método", "Tipo", "Banco", "Monto", "Nota"];
  drawRow(doc, headers, widths, {
    header: true,
  });
  if (model.movements.length === 0) {
    drawTableBodyRow(doc, ["Sin movimientos para los filtros seleccionados", "", "", "", "", "", ""], widths, headers);
    return;
  }

  for (const movement of model.movements) {
    drawTableBodyRow(
      doc,
      [
        formatDate(movement.dateKey),
        movement.patientName,
        METHOD_LABELS.get(movement.method) ?? movement.method,
        INCOME_TYPE_LABELS.get(movement.incomeType) ?? movement.incomeType,
        movement.bank ? BANK_LABELS.get(movement.bank) ?? movement.bank : "",
        formatCurrency(movement.amount),
        movement.note ?? "",
      ],
      widths,
      headers,
    );
  }
}

/** Render the cashbox report model to PDF bytes. */
export async function cashboxReportToPdf(model: CashboxReportModel): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: "LETTER", margin: PAGE.margin, bufferPages: false });
  const done = collectPdfBytes(doc);

  doc.info.Title = "Caja y Finanzas - Reporte";
  doc.info.Author = "MEDIASSWINT";
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Caja y Finanzas - Reporte");
  doc.moveDown(0.4);
  metaLine(doc, "Rango", `${formatDate(model.meta.from)} - ${formatDate(model.meta.to)}`);
  metaLine(doc, "Generado", new Date(model.meta.generatedAt).toLocaleString("es-CO"));
  metaLine(doc, "Filtro método (detalle)", model.meta.method ?? "Todos");
  metaLine(doc, "Filtro paciente (detalle)", model.meta.search ?? "Todos");

  sectionTitle(doc, "Totales por método de pago");
  drawKeyValueTable(
    doc,
    model.totalsByMethod.map((entry) => [entry.label, formatCurrency(entry.total)]),
  );
  doc.moveDown(0.4);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6B7280").text(
    "Nota: solo Efectivo es caja física. Bancos / electrónicos y Otro NO entran en la venta bruta.",
  );

  sectionTitle(doc, "Totales del rango");
  drawKeyValueTable(doc, [
    ["Total Abonos", formatCurrency(model.totals.totalAbonos)],
    ["Total Reclamados", formatCurrency(model.totals.totalReclamados)],
    ["Total bancos", formatCurrency(model.totals.totalBancos)],
    ["Venta bruta (efectivo)", formatCurrency(model.totals.ventaBruta)],
    ["Egresos", formatCurrency(model.totals.egresos)],
    ["Venta neta efectivo", formatCurrency(model.totals.ventaNetaEfectivo)],
  ]);
  doc.moveDown(0.4);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6B7280").text(
    "Real contado y Diferencia se muestran por día; no se totalizan en el rango para evitar conciliaciones engañosas.",
  );

  drawDailyBreakdown(doc, model);
  drawMovements(doc, model);

  doc.end();
  return done;
}
