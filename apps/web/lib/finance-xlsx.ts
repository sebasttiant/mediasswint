// ExcelJS serializer for the cashbox report. This is the thin I/O layer: it consumes
// the pure CashboxReportModel (already tested) and renders it to an .xlsx workbook.
// No figures are computed here — only laid out — so the spreadsheet always mirrors
// the on-screen, filtered numbers.

import ExcelJS from "exceljs";

import type { DailyCashboxRow } from "@/lib/cashbox";
import type { CashboxReportModel } from "@/lib/finance-report";
import { BANK_LABELS, INCOME_TYPE_LABELS, METHOD_LABELS, formatDate } from "@/lib/finance-format";

const MONEY_FMT = "#,##0.00";
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
}

const DAILY_COLUMNS: ReadonlyArray<{
  header: string;
  key: keyof DailyCashboxRow | "fecha";
  money?: boolean;
}> = [
  { header: "Fecha", key: "fecha" },
  { header: "1 Vez", key: "primeraVez", money: true },
  { header: "R", key: "r", money: true },
  { header: "MEFE", key: "mefe", money: true },
  { header: "Total Abonos", key: "totalAbonos", money: true },
  { header: "Recl. 1 Vez", key: "reclamadoPrimeraVez", money: true },
  { header: "Recl. R", key: "reclamadoR", money: true },
  { header: "Total Reclamados", key: "totalReclamados", money: true },
  { header: "Efectivo", key: "efectivo", money: true },
  { header: "Transferencia", key: "transferencias", money: true },
  { header: "BOLD", key: "bold", money: true },
  { header: "Tarjeta débito", key: "tarjetaDebito", money: true },
  { header: "Tarjeta crédito", key: "tarjetaCredito", money: true },
  { header: "Otros", key: "otros", money: true },
  { header: "Total bancos", key: "totalBancos", money: true },
  { header: "Venta bruta", key: "ventaBruta", money: true },
  { header: "Egresos", key: "egresos", money: true },
  { header: "Venta neta", key: "ventaNetaEfectivo", money: true },
  { header: "Real contado", key: "realContado", money: true },
  { header: "Diferencia", key: "diferencia", money: true },
];

function buildSummarySheet(wb: ExcelJS.Workbook, model: CashboxReportModel): void {
  const sheet = wb.addWorksheet("Resumen");

  sheet.addRow(["Caja y Finanzas — Reporte"]).font = { bold: true, size: 14 };
  sheet.addRow([
    "Rango",
    `${formatDate(model.meta.from)} – ${formatDate(model.meta.to)}`,
  ]);
  sheet.addRow(["Generado", new Date(model.meta.generatedAt).toLocaleString("es-CO")]);
  if (model.meta.method) sheet.addRow(["Filtro método (detalle)", model.meta.method]);
  if (model.meta.search) sheet.addRow(["Filtro paciente (detalle)", model.meta.search]);
  sheet.addRow([]);

  // Totals by method.
  styleHeaderRow(sheet.addRow(["Totales por método de pago", "Total"]));
  for (const entry of model.totalsByMethod) {
    const row = sheet.addRow([entry.label, entry.total]);
    row.getCell(2).numFmt = MONEY_FMT;
  }
  sheet.addRow([
    "Nota: solo Efectivo es caja física. Bancos / electrónicos y Otro NO entran en la venta bruta.",
  ]).font = { italic: true, color: { argb: "FF6B7280" } };
  sheet.addRow([]);

  // Cash-chain totals for the range. Real contado / Diferencia are intentionally NOT
  // aggregated here: ventaNeta sums over every day but a count only exists on some, so
  // a range-level "realContado - ventaNeta = diferencia" identity would not hold and a
  // summed difference would hide opposing daily offsets. They stay per-day below.
  styleHeaderRow(sheet.addRow(["Totales del rango", "Valor"]));
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
    row.getCell(2).numFmt = MONEY_FMT;
  }
  sheet.addRow([
    "Real contado y Diferencia: ver columnas por día abajo (no se totalizan en el rango).",
  ]).font = { italic: true, color: { argb: "FF6B7280" } };
  sheet.addRow([]);

  // Daily breakdown.
  styleHeaderRow(sheet.addRow(["Resumen diario"]));
  styleHeaderRow(sheet.addRow(DAILY_COLUMNS.map((c) => c.header)));
  for (const day of model.daily) {
    const cells = DAILY_COLUMNS.map((col) => {
      if (col.key === "fecha") return formatDate(day.date);
      const value = day[col.key];
      return value === null ? "Pendiente" : value;
    });
    const row = sheet.addRow(cells);
    DAILY_COLUMNS.forEach((col, idx) => {
      if (col.money) {
        const cell = row.getCell(idx + 1);
        if (typeof cell.value === "number") cell.numFmt = MONEY_FMT;
      }
    });
  }

  sheet.columns.forEach((column) => {
    column.width = 16;
  });
}

function buildMovementsSheet(wb: ExcelJS.Workbook, model: CashboxReportModel): void {
  const sheet = wb.addWorksheet("Movimientos");
  styleHeaderRow(
    sheet.addRow(["Fecha", "Paciente", "Método", "Tipo", "Banco", "Monto", "Nota"]),
  );

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
    row.getCell(6).numFmt = MONEY_FMT;
  }

  sheet.columns = [
    { width: 12 },
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 30 },
  ];
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
