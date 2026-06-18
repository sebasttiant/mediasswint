// PDFKit serializer for the cashbox report. It consumes the already-built
// CashboxReportModel and only lays out values; all accounting logic stays in
// finance-report/buildDailyCashbox.

import { createRequire } from "node:module";

import type { DailyCashboxRow } from "@/lib/cashbox";
import type { CashboxReportModel } from "@/lib/finance-report";
import { BANK_LABELS, INCOME_TYPE_LABELS, METHOD_LABELS, formatDate, formatTimestamp } from "@/lib/finance-format";

type PDFDocumentConstructor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit/js/pdfkit.standalone.js") as PDFDocumentConstructor;

const MONEY_FORMATTER = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// LETTER is 612 x 792 pt. With a 36pt margin the printable box is 540 wide and the body
// must stop at 756 (792 - 36) so the per-page footer drawn at FOOTER_Y stays clear of it.
const PAGE = {
  margin: 36,
  bottom: 740,
  width: 540,
  footerY: 760,
} as const;

type Align = "left" | "right";

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

// Every text helper writes from PAGE.margin with an explicit width. PDFKit leaves doc.x
// wherever the last write ended, so a title written after a table would otherwise inherit
// the last column's x and wrap into a tall, right-shifted sliver. Pinning x + width here
// (and resetting doc.x in drawRow) keeps section titles and notes flush-left, full-width.
function resetX(doc: PDFKit.PDFDocument): void {
  doc.x = PAGE.margin;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  ensureSpace(doc, 36);
  doc.moveDown(0.8);
  resetX(doc);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text(title, PAGE.margin, doc.y, { width: PAGE.width, lineBreak: false });
  doc.moveDown(0.3);
  resetX(doc);
}

function metaLine(doc: PDFKit.PDFDocument, label: string, value: string): void {
  resetX(doc);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#374151")
    .text(`${label}: `, PAGE.margin, doc.y, { continued: true });
  doc.font("Helvetica").fillColor("#374151").text(value);
  resetX(doc);
}

function note(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.4);
  resetX(doc);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#6B7280")
    .text(text, PAGE.margin, doc.y, { width: PAGE.width });
  resetX(doc);
}

function drawRow(
  doc: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  options: { header?: boolean; height?: number; aligns?: readonly Align[] } = {},
): void {
  const height = options.height ?? 20;
  ensureSpace(doc, height + 2);
  const startX = PAGE.margin;
  const startY = doc.y;
  let x = startX;

  doc.font(options.header ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor("#111827");
  if (options.header) {
    doc.rect(startX, startY, widths.reduce((acc, width) => acc + width, 0), height).fill("#F3F4F6");
    doc.fillColor("#111827");
  }

  cells.forEach((cell, index) => {
    doc.text(cell, x + 3, startY + 5, {
      width: widths[index] - 6,
      height: height - 8,
      ellipsis: true,
      align: options.aligns?.[index] ?? "left",
    });
    x += widths[index];
  });

  doc
    .strokeColor("#E5E7EB")
    .lineWidth(0.5)
    .moveTo(startX, startY + height)
    .lineTo(startX + PAGE.width, startY + height)
    .stroke();
  doc.y = startY + height;
  resetX(doc);
}

const KEY_VALUE_ALIGNS: readonly Align[] = ["left", "right"];

function drawKeyValueTable(doc: PDFKit.PDFDocument, rows: ReadonlyArray<readonly [string, string]>): void {
  for (const [label, value] of rows) {
    drawRow(doc, [label, value], [300, 240], { aligns: KEY_VALUE_ALIGNS });
  }
}

function drawTableBodyRow(
  doc: PDFKit.PDFDocument,
  cells: readonly string[],
  widths: readonly number[],
  headerCells: readonly string[],
  aligns?: readonly Align[],
): void {
  if (doc.y + 20 > PAGE.bottom) {
    doc.addPage();
    // Repeat the header on every page so a long detail stays readable when it overflows.
    drawRow(doc, headerCells, widths, { header: true, aligns });
  }
  drawRow(doc, cells, widths, { aligns });
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
  const widths = [56, 58, 66, 56, 64, 50, 62, 64, 64];
  // Fecha left, every money column right so the digits line up and read as a ledger.
  const aligns: readonly Align[] = ["left", "right", "right", "right", "right", "right", "right", "right", "right"];
  const headers = DAILY_COLUMNS.map((column) => column.label);
  drawRow(doc, headers, widths, { header: true, aligns });
  for (const day of model.daily) {
    drawTableBodyRow(doc, DAILY_COLUMNS.map((column) => column.pick(day)), widths, headers, aligns);
  }
}

function drawMovements(doc: PDFKit.PDFDocument, model: CashboxReportModel): void {
  sectionTitle(doc, "Detalle de movimientos");
  const widths = [56, 108, 70, 64, 56, 70, 116];
  const aligns: readonly Align[] = ["left", "left", "left", "left", "left", "right", "left"];
  const headers = ["Fecha", "Paciente", "Método", "Tipo", "Banco", "Monto", "Nota"];
  drawRow(doc, headers, widths, { header: true, aligns });
  if (model.movements.length === 0) {
    drawTableBodyRow(doc, ["Sin movimientos para los filtros seleccionados", "", "", "", "", "", ""], widths, headers, aligns);
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
      aligns,
    );
  }
}

function drawFooter(doc: PDFKit.PDFDocument, generatedLabel: string): void {
  // bufferPages lets us walk every page after layout to stamp a consistent footer with
  // the report context + "Página X de Y", so a multi-page detail never loses its origin.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // The footer sits below the bottom margin; PDFKit would auto-insert a blank page when
    // text is drawn past it, so drop the bottom margin to 0 for the stamp and restore it.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor("#9CA3AF");
    doc.text(`MEDIASSWINT · Caja y Finanzas · ${generatedLabel}`, PAGE.margin, PAGE.footerY, {
      width: PAGE.width,
      align: "left",
      lineBreak: false,
    });
    doc.text(`Página ${i - range.start + 1} de ${range.count}`, PAGE.margin, PAGE.footerY, {
      width: PAGE.width,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

/** Render the cashbox report model to PDF bytes. */
export async function cashboxReportToPdf(model: CashboxReportModel): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new PDFDocument({ size: "LETTER", margin: PAGE.margin, bufferPages: true });
  const done = collectPdfBytes(doc);
  const generatedLabel = formatTimestamp(model.meta.generatedAt);

  doc.info.Title = "Caja y Finanzas - Reporte";
  doc.info.Author = "MEDIASSWINT";
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("Caja y Finanzas - Reporte", PAGE.margin, doc.y, {
    width: PAGE.width,
    lineBreak: false,
  });
  doc.moveDown(0.4);
  metaLine(doc, "Rango", `${formatDate(model.meta.from)} - ${formatDate(model.meta.to)}`);
  metaLine(doc, "Generado", generatedLabel);
  metaLine(doc, "Filtro método (detalle)", model.meta.method ?? "Todos");
  metaLine(doc, "Filtro paciente (detalle)", model.meta.search ?? "Todos");

  sectionTitle(doc, "Totales por método de pago");
  drawKeyValueTable(
    doc,
    model.totalsByMethod.map((entry) => [entry.label, formatCurrency(entry.total)]),
  );
  note(doc, "Nota: solo Efectivo es caja física. Bancos / electrónicos y Otro NO entran en la venta bruta.");

  sectionTitle(doc, "Totales del rango");
  drawKeyValueTable(doc, [
    ["Total Abonos", formatCurrency(model.totals.totalAbonos)],
    ["Total Reclamados", formatCurrency(model.totals.totalReclamados)],
    ["Total bancos", formatCurrency(model.totals.totalBancos)],
    ["Venta bruta (efectivo)", formatCurrency(model.totals.ventaBruta)],
    ["Egresos", formatCurrency(model.totals.egresos)],
    ["Venta neta efectivo", formatCurrency(model.totals.ventaNetaEfectivo)],
  ]);
  note(doc, "Real contado y Diferencia se muestran por día; no se totalizan en el rango para evitar conciliaciones engañosas.");

  drawDailyBreakdown(doc, model);
  drawMovements(doc, model);

  drawFooter(doc, generatedLabel);

  doc.end();
  return done;
}
