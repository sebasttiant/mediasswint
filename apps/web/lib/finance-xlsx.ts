// ExcelJS serializer for the cashbox report. This is the thin I/O layer: it consumes
// the pure CashboxReportModel (already tested) and renders it to an .xlsx workbook.
// No figures are computed here — only laid out — so the spreadsheet always mirrors
// the on-screen, filtered numbers.

import ExcelJS from "exceljs";

import { CASHBOX_COLORS, type DailyCashboxRow } from "@/lib/cashbox";
import type { CashboxReportModel } from "@/lib/finance-report";
import { BANK_LABELS, INCOME_TYPE_LABELS, METHOD_LABELS, formatDate, formatTimestamp } from "@/lib/finance-format";

const MONEY_FMT = '"$"#,##0;[Red]-"$"#,##0;"$"0';
const WHITE_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const TITLE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F172A" },
};
const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF334155" },
};
const SUBTLE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF8FAFC" },
};
const NOTE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF7ED" },
};
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

const GROUP_COLORS = {
  abonos: hexToArgb(CASHBOX_COLORS.abonos),
  reclamados: hexToArgb(CASHBOX_COLORS.reclamados),
  bancos: hexToArgb(CASHBOX_COLORS.bancos),
  ventaNetaEfectivo: hexToArgb(CASHBOX_COLORS.ventaNetaEfectivo),
  efectivo: "FFD1FAE5",
  conciliacion: "FFE2E8F0",
  diferencia: "FFFEE2E2",
} as const;

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleSectionRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = SECTION_FILL;
    cell.font = WHITE_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = BORDER;
  });
}

function styleCell(cell: ExcelJS.Cell, options: { bold?: boolean; fill?: string; money?: boolean } = {}): void {
  cell.border = BORDER;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  if (options.bold) cell.font = { ...(cell.font ?? {}), bold: true };
  if (options.fill) cell.fill = fill(options.fill);
  if (options.money && typeof cell.value === "number") {
    cell.numFmt = MONEY_FMT;
    cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
  }
}

function styleRow(row: ExcelJS.Row, options: { fill?: string; bold?: boolean } = {}): void {
  row.eachCell((cell) => styleCell(cell, options));
}

const DAILY_COLUMNS: ReadonlyArray<{
  header: string;
  key: keyof DailyCashboxRow | "fecha";
  money?: boolean;
  fill?: string;
  strong?: boolean;
}> = [
  { header: "Fecha", key: "fecha" },
  { header: "1 Vez", key: "primeraVez", money: true, fill: GROUP_COLORS.abonos },
  { header: "R", key: "r", money: true, fill: GROUP_COLORS.abonos },
  { header: "MEFE", key: "mefe", money: true, fill: GROUP_COLORS.abonos },
  { header: "Total Abonos", key: "totalAbonos", money: true, fill: GROUP_COLORS.abonos, strong: true },
  { header: "Recl. 1 Vez", key: "reclamadoPrimeraVez", money: true, fill: GROUP_COLORS.reclamados },
  { header: "Recl. R", key: "reclamadoR", money: true, fill: GROUP_COLORS.reclamados },
  { header: "Total Reclamados", key: "totalReclamados", money: true, fill: GROUP_COLORS.reclamados, strong: true },
  { header: "Efectivo", key: "efectivo", money: true, fill: GROUP_COLORS.efectivo },
  { header: "Transferencia", key: "transferencias", money: true, fill: GROUP_COLORS.bancos },
  { header: "BOLD", key: "bold", money: true, fill: GROUP_COLORS.bancos },
  { header: "Tarjeta débito", key: "tarjetaDebito", money: true, fill: GROUP_COLORS.bancos },
  { header: "Tarjeta crédito", key: "tarjetaCredito", money: true, fill: GROUP_COLORS.bancos },
  { header: "Otros", key: "otros", money: true, fill: GROUP_COLORS.bancos },
  { header: "Total bancos", key: "totalBancos", money: true, fill: GROUP_COLORS.bancos, strong: true },
  { header: "Venta bruta", key: "ventaBruta", money: true, fill: GROUP_COLORS.conciliacion, strong: true },
  { header: "Egresos", key: "egresos", money: true, fill: GROUP_COLORS.conciliacion },
  { header: "Venta neta", key: "ventaNetaEfectivo", money: true, fill: GROUP_COLORS.ventaNetaEfectivo, strong: true },
  { header: "Real contado", key: "realContado", money: true, fill: GROUP_COLORS.conciliacion },
  { header: "Diferencia", key: "diferencia", money: true, fill: GROUP_COLORS.diferencia, strong: true },
];

const DAILY_GROUPS: ReadonlyArray<{ label: string; from: number; to: number; fill: string }> = [
  { label: "Abonos", from: 2, to: 5, fill: GROUP_COLORS.abonos },
  { label: "Reclamados", from: 6, to: 8, fill: GROUP_COLORS.reclamados },
  { label: "Caja física", from: 9, to: 9, fill: GROUP_COLORS.efectivo },
  { label: "Bancos / electrónicos", from: 10, to: 15, fill: GROUP_COLORS.bancos },
  { label: "Conciliación", from: 16, to: 20, fill: GROUP_COLORS.conciliacion },
];

function buildSummarySheet(wb: ExcelJS.Workbook, model: CashboxReportModel): void {
  const sheet = wb.addWorksheet("Resumen");
  // Freeze the title row and the Fecha column. The daily table is 20 columns wide, so a
  // frozen date column keeps each row identifiable when scrolling right; a fixed-row split
  // (the old ySplit:22) froze arbitrary mid-summary rows and broke as the layout shifted.
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  sheet.properties.defaultRowHeight = 22;
  sheet.columns = [
    { width: 14 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
    { width: 17 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 15 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  sheet.mergeCells("A1:T1");
  const title = sheet.getCell("A1");
  title.value = "Caja y Finanzas - Reporte";
  title.fill = TITLE_FILL;
  title.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 30;

  const metaRows: ReadonlyArray<readonly [string, string]> = [
    ["Rango", `${formatDate(model.meta.from)} - ${formatDate(model.meta.to)}`],
    ["Generado", formatTimestamp(model.meta.generatedAt)],
    ["Filtro método (detalle)", model.meta.method ?? "Todos"],
    ["Filtro paciente (detalle)", model.meta.search ?? "Todos"],
  ];
  for (const [label, value] of metaRows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: "FF334155" } };
    row.getCell(1).fill = SUBTLE_FILL;
    row.getCell(2).fill = SUBTLE_FILL;
    styleRow(row);
  }
  sheet.addRow([]);

  styleSectionRow(sheet.addRow(["Totales por método de pago", "Total"]));
  for (const entry of model.totalsByMethod) {
    const row = sheet.addRow([entry.label, entry.total]);
    styleRow(row);
    styleCell(row.getCell(2), { money: true });
  }
  const methodNote = sheet.addRow([
    "Nota: solo Efectivo es caja física. Bancos / electrónicos y Otro NO entran en la venta bruta.",
  ]);
  sheet.mergeCells(methodNote.number, 1, methodNote.number, 6);
  methodNote.font = { italic: true, color: { argb: "FF92400E" } };
  methodNote.eachCell((cell) => {
    cell.fill = NOTE_FILL;
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  methodNote.height = 32;
  sheet.addRow([]);

  // Cash-chain totals for the range. Real contado / Diferencia are intentionally NOT
  // aggregated here: ventaNeta sums over every day but a count only exists on some, so
  // a range-level "realContado - ventaNeta = diferencia" identity would not hold and a
  // summed difference would hide opposing daily offsets. They stay per-day below.
  styleSectionRow(sheet.addRow(["Totales del rango", "Valor"]));
  const totalsRows: ReadonlyArray<[string, number]> = [
    ["Total Abonos", model.totals.totalAbonos],
    ["Total Reclamados", model.totals.totalReclamados],
    ["Total bancos", model.totals.totalBancos],
    ["Venta bruta (efectivo)", model.totals.ventaBruta],
    ["Egresos", model.totals.egresos],
    ["Venta neta efectivo", model.totals.ventaNetaEfectivo],
  ];
  for (const [label, value] of totalsRows) {
    const row = sheet.addRow([label, value]);
    styleRow(row);
    styleCell(row.getCell(2), { money: true });
  }
  const totalsNote = sheet.addRow([
    "Real contado y Diferencia: ver columnas por día abajo (no se totalizan en el rango).",
  ]);
  sheet.mergeCells(totalsNote.number, 1, totalsNote.number, 6);
  totalsNote.font = { italic: true, color: { argb: "FF92400E" } };
  totalsNote.eachCell((cell) => {
    cell.fill = NOTE_FILL;
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  totalsNote.height = 32;
  sheet.addRow([]);

  styleSectionRow(sheet.addRow(["Resumen diario"]));
  // Add BOTH the group row and the real header row before merging. Merging A across two
  // rows first makes the next addRow skip the (already-occupied) header row, which is what
  // left a phantom blank row between the grouped and real headers. Create then merge.
  const groupRow = sheet.addRow(["Fecha", ...Array.from({ length: DAILY_COLUMNS.length - 1 }, () => "")]);
  const headerRow = sheet.addRow(DAILY_COLUMNS.map((c) => c.header));

  sheet.mergeCells(groupRow.number, 1, headerRow.number, 1);
  for (const group of DAILY_GROUPS) {
    sheet.mergeCells(groupRow.number, group.from, groupRow.number, group.to);
    const cell = groupRow.getCell(group.from);
    cell.value = group.label;
    styleCell(cell, { fill: group.fill, bold: true });
  }
  styleCell(groupRow.getCell(1), { fill: "FFE2E8F0", bold: true });

  DAILY_COLUMNS.forEach((column, index) => {
    styleCell(headerRow.getCell(index + 1), { fill: column.fill ?? "FFE2E8F0", bold: true });
  });
  groupRow.height = 26;
  headerRow.height = 38;
  for (const day of model.daily) {
    const cells = DAILY_COLUMNS.map((col) => {
      if (col.key === "fecha") return formatDate(day.date);
      const value = day[col.key];
      return value === null ? "Pendiente" : value;
    });
    const row = sheet.addRow(cells);
    DAILY_COLUMNS.forEach((col, idx) => {
      styleCell(row.getCell(idx + 1), { fill: col.fill, money: col.money, bold: col.strong });
    });
    row.height = 24;
  }
}

function buildMovementsSheet(wb: ExcelJS.Workbook, model: CashboxReportModel): void {
  const sheet = wb.addWorksheet("Movimientos");
  // Freeze through the column header (row 4) and the Fecha column, so scrolling the detail
  // keeps both the headers and the date in view. The old ySplit:5 also froze the first data
  // row, pinning a real movement to the top.
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  sheet.properties.defaultRowHeight = 22;
  sheet.columns = [
    { width: 13 },
    { width: 34 },
    { width: 18 },
    { width: 20 },
    { width: 17 },
    { width: 16 },
    { width: 52 },
  ];

  sheet.mergeCells("A1:G1");
  const title = sheet.getCell("A1");
  title.value = "Detalle de movimientos";
  title.fill = TITLE_FILL;
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 28;
  const meta = sheet.addRow([
    "Rango",
    `${formatDate(model.meta.from)} - ${formatDate(model.meta.to)}`,
    "Método",
    model.meta.method ?? "Todos",
    "Paciente",
    model.meta.search ?? "Todos",
  ]);
  styleRow(meta, { fill: "FFF8FAFC", bold: true });
  sheet.addRow([]);

  const header = sheet.addRow(["Fecha", "Paciente", "Método", "Tipo", "Banco", "Monto", "Nota"]);
  styleSectionRow(header);
  header.height = 28;

  for (const movement of model.movements) {
    const row = sheet.addRow([
      formatDate(movement.dateKey),
      movement.patientName,
      METHOD_LABELS.get(movement.method) ?? movement.method,
      INCOME_TYPE_LABELS.get(movement.incomeType) ?? movement.incomeType,
      movement.bank ? BANK_LABELS.get(movement.bank) ?? movement.bank : "",
      movement.amount,
      movement.note ?? "",
    ]);
    styleRow(row);
    styleCell(row.getCell(6), { money: true });
    row.getCell(7).alignment = { vertical: "top", horizontal: "left", wrapText: true };
    row.height = movement.note ? 34 : 24;
  }
}

/** Render the cashbox report model to an .xlsx workbook as bytes (a valid BodyInit). */
export async function cashboxReportToXlsx(
  model: CashboxReportModel,
): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MEDIASSWINT";
  wb.created = new Date(model.meta.generatedAt);

  buildSummarySheet(wb, model);
  buildMovementsSheet(wb, model);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer as ArrayBuffer);
}
