// Pure report model for the cashbox export. The route fetches the SAME data the
// screen shows (fetchDailyCashbox + fetchPaymentMovements), then this builder shapes
// it into the export model. Keeping it free of any I/O (and of ExcelJS / PDF) lets us
// unit-test the numbers — the part that must never drift from the on-screen figures.

import {
  PAYMENT_METHODS,
  round2,
  type DailyCashboxRow,
  type PaymentMethod,
  type PaymentMovementDetail,
} from "@/lib/cashbox";

export type CashboxReportMeta = {
  from: string;
  to: string;
  generatedAt: string;
  method: string | null;
  search: string | null;
};

export type CashboxReportTotals = {
  totalAbonos: number;
  totalReclamados: number;
  efectivo: number;
  transferencias: number;
  bold: number;
  tarjetaDebito: number;
  tarjetaCredito: number;
  otros: number;
  totalBancos: number;
  ventaBruta: number;
  egresos: number;
  ventaNetaEfectivo: number;
  realContado: number | null;
  diferencia: number | null;
};

export type MethodTotal = { method: PaymentMethod; label: string; total: number };

export type CashboxReportModel = {
  meta: CashboxReportMeta;
  daily: DailyCashboxRow[];
  totals: CashboxReportTotals;
  totalsByMethod: MethodTotal[];
  movements: PaymentMovementDetail[];
};

/**
 * Sum a nullable per-day field across the range. Returns null only when no day in the
 * range carried a value (e.g. no cash count anywhere), so an all-pending range stays
 * pending instead of collapsing to a misleading 0.
 */
function sumNullable(rows: DailyCashboxRow[], pick: (row: DailyCashboxRow) => number | null): number | null {
  let seen = false;
  let acc = 0;
  for (const row of rows) {
    const value = pick(row);
    if (value !== null) {
      seen = true;
      acc += value;
    }
  }
  return seen ? round2(acc) : null;
}

function sum(rows: DailyCashboxRow[], pick: (row: DailyCashboxRow) => number): number {
  return round2(rows.reduce((acc, row) => acc + pick(row), 0));
}

export type BuildReportInput = {
  range: { from: string; to: string };
  rows: DailyCashboxRow[];
  movements: PaymentMovementDetail[];
  method?: string | null;
  search?: string | null;
  generatedAt: Date;
};

/**
 * Build the export model from already-filtered data. The daily rows and movements are
 * passed in exactly as the screen received them, so the export mirrors the filtered
 * view — never the whole ledger. Totals are derived from those same rows.
 */
export function buildCashboxReportModel(input: BuildReportInput): CashboxReportModel {
  const { range, rows, movements, generatedAt } = input;

  const totalsByMethod: MethodTotal[] = [
    { method: "EFECTIVO" as const, total: sum(rows, (r) => r.efectivo) },
    { method: "TRANSFERENCIA" as const, total: sum(rows, (r) => r.transferencias) },
    { method: "BOLD" as const, total: sum(rows, (r) => r.bold) },
    { method: "TARJETA_DEBITO" as const, total: sum(rows, (r) => r.tarjetaDebito) },
    { method: "TARJETA_CREDITO" as const, total: sum(rows, (r) => r.tarjetaCredito) },
    { method: "OTRO" as const, total: sum(rows, (r) => r.otros) },
  ].map((entry) => ({
    ...entry,
    label: PAYMENT_METHODS.find((m) => m.value === entry.method)?.label ?? entry.method,
  }));

  const totals: CashboxReportTotals = {
    totalAbonos: sum(rows, (r) => r.totalAbonos),
    totalReclamados: sum(rows, (r) => r.totalReclamados),
    efectivo: sum(rows, (r) => r.efectivo),
    transferencias: sum(rows, (r) => r.transferencias),
    bold: sum(rows, (r) => r.bold),
    tarjetaDebito: sum(rows, (r) => r.tarjetaDebito),
    tarjetaCredito: sum(rows, (r) => r.tarjetaCredito),
    otros: sum(rows, (r) => r.otros),
    totalBancos: sum(rows, (r) => r.totalBancos),
    ventaBruta: sum(rows, (r) => r.ventaBruta),
    egresos: sum(rows, (r) => r.egresos),
    ventaNetaEfectivo: sum(rows, (r) => r.ventaNetaEfectivo),
    realContado: sumNullable(rows, (r) => r.realContado),
    diferencia: sumNullable(rows, (r) => r.diferencia),
  };

  return {
    meta: {
      from: range.from,
      to: range.to,
      generatedAt: generatedAt.toISOString(),
      method: input.method?.trim() ? input.method.trim() : null,
      search: input.search?.trim() ? input.search.trim() : null,
    },
    daily: rows,
    totals,
    totalsByMethod,
    movements,
  };
}
