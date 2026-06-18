// Caja y Finanzas — pure cashbox logic.
//
// This module is intentionally free of any I/O so the Excel formulas can be
// unit-tested in isolation. The DB layer (lib/finance.ts) maps PaymentMovement /
// Expense / DailyCashCount rows into the plain shapes consumed here.

export type PaymentMethod =
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "BOLD"
  | "TARJETA_DEBITO"
  | "TARJETA_CREDITO"
  | "OTRO";

export type PaymentBank = "BANCOLOMBIA" | "NEQUI" | "DAVIPLATA" | "OTRO_BANCO" | "OTRO";

export type PaymentIncomeType =
  | "PRIMERA_VEZ"
  | "R"
  | "MEFE"
  | "RECLAMADO_PRIMERA_VEZ"
  | "RECLAMADO_R";

// Form option lists. Labels are user-facing (Spanish, matching the Excel wording).
export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "BOLD", label: "BOLD" },
  { value: "TARJETA_DEBITO", label: "Tarjeta débito" },
  { value: "TARJETA_CREDITO", label: "Tarjeta crédito" },
  { value: "OTRO", label: "Otro" },
];

export const PAYMENT_BANKS: ReadonlyArray<{ value: PaymentBank; label: string }> = [
  { value: "BANCOLOMBIA", label: "Bancolombia" },
  { value: "NEQUI", label: "Nequi" },
  { value: "DAVIPLATA", label: "Daviplata" },
  { value: "OTRO_BANCO", label: "Otro banco" },
  { value: "OTRO", label: "Otro" },
];

export const PAYMENT_INCOME_TYPES: ReadonlyArray<{ value: PaymentIncomeType; label: string }> = [
  { value: "PRIMERA_VEZ", label: "1 Vez" },
  { value: "R", label: "R" },
  { value: "MEFE", label: "MEFE" },
  { value: "RECLAMADO_PRIMERA_VEZ", label: "Reclamado 1 Vez" },
  { value: "RECLAMADO_R", label: "Reclamado R" },
];

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value);
export const PAYMENT_BANK_VALUES = PAYMENT_BANKS.map((b) => b.value);
export const PAYMENT_INCOME_TYPE_VALUES = PAYMENT_INCOME_TYPES.map((t) => t.value);

// Excel palette, reused by the UI so the cashbox reads like the original sheet.
export const CASHBOX_COLORS = {
  abonos: "#FFFFCC",
  reclamados: "#FF99CC",
  bancos: "#99CCFF",
  ventaNetaEfectivo: "#FFFF00",
} as const;

export type CashboxMovement = {
  amount: number;
  method: PaymentMethod;
  incomeType: PaymentIncomeType;
  dateKey: string; // YYYY-MM-DD (see toCashboxDateKey)
};

export type CashboxExpense = { amount: number; dateKey: string };
export type CashboxCount = { amount: number; dateKey: string };

export type DailyCashboxRow = {
  date: string;
  // Abonos (by income type)
  primeraVez: number;
  r: number;
  mefe: number;
  totalAbonos: number;
  // Reclamados (by income type)
  reclamadoPrimeraVez: number;
  reclamadoR: number;
  totalReclamados: number;
  // Medios de pago (by method)
  efectivo: number;
  transferencias: number;
  bold: number;
  tarjetaDebito: number;
  tarjetaCredito: number;
  otros: number;
  totalBancos: number;
  // Cashbox formulas
  ventaBruta: number;
  egresos: number;
  ventaNetaEfectivo: number;
  realContado: number | null;
  diferencia: number | null;
};

const BOGOTA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Calendar-day key (YYYY-MM-DD) for a payment instant, anchored to the clinic's
 * timezone (America/Bogota). Anchoring avoids a payment near midnight landing in
 * the wrong day's cashbox depending on the server's UTC offset.
 */
export function toCashboxDateKey(date: Date): string {
  return BOGOTA_DATE_FORMATTER.format(date);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Guard against calendar-shaped but impossible dates (e.g. 2026-13-40), which the
  // regex alone would accept.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type CashboxRange = { from: string; to: string };

/**
 * Shift a YYYY-MM-DD key by a number of calendar days. Pure date arithmetic on the
 * key itself (anchored at midnight UTC) so it never drifts across a timezone. Used
 * by the quick range presets ("últimos 7 días", etc.).
 */
export function shiftDateKey(key: string, days: number): string {
  const base = new Date(`${key}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/**
 * Resolve the date range that drives the daily summary / reconciliation. Missing or
 * malformed bounds fall back to `today` (so the screen defaults to "Hoy" instead of
 * loading all history), and an inverted range is swapped so it is never empty.
 *
 * Method / patient filters never reach this function: per the cashbox accounting
 * rule, only date/range narrows the daily reconciliation.
 */
export function resolveCashboxRange(
  params: { from?: string | null; to?: string | null },
  today: string,
): CashboxRange {
  const from = isValidDateKey(params.from) ? params.from : today;
  const to = isValidDateKey(params.to) ? params.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * Inclusive membership of a YYYY-MM-DD key in a range. Keys compare correctly as
 * strings, so no Date parsing is needed.
 */
export function isDateKeyInRange(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

/**
 * Keep only the daily rows whose calendar day falls inside the inclusive range.
 */
export function filterDailyRowsByRange(
  rows: DailyCashboxRow[],
  from: string,
  to: string,
): DailyCashboxRow[] {
  return rows.filter((row) => isDateKeyInRange(row.date, from, to));
}

/** Type guard for the PaymentMethod enum, used to validate untrusted query params. */
export function isPaymentMethod(value: string | null | undefined): value is PaymentMethod {
  return value != null && (PAYMENT_METHOD_VALUES as readonly string[]).includes(value);
}

/**
 * A single payment movement, flattened for the movement-level detail view. This is
 * the ONLY surface that method / patient filters narrow — never the daily
 * reconciliation, whose accounting must stay whole.
 */
export type PaymentMovementDetail = {
  id: string;
  dateKey: string; // Bogota calendar day (see toCashboxDateKey)
  patientName: string;
  method: PaymentMethod;
  incomeType: PaymentIncomeType;
  amount: number;
  bank: PaymentBank | null;
  note: string | null;
};

/** Keep only the movements whose Bogota day falls inside the inclusive range. */
export function filterMovementsByDateRange(
  rows: PaymentMovementDetail[],
  from: string,
  to: string,
): PaymentMovementDetail[] {
  return rows.filter((row) => isDateKeyInRange(row.dateKey, from, to));
}

type Accumulator = {
  primeraVez: number;
  r: number;
  mefe: number;
  reclamadoPrimeraVez: number;
  reclamadoR: number;
  efectivo: number;
  transferencias: number;
  bold: number;
  tarjetaDebito: number;
  tarjetaCredito: number;
  otros: number;
  egresos: number;
  realContado: number | null;
};

function emptyAccumulator(): Accumulator {
  return {
    primeraVez: 0,
    r: 0,
    mefe: 0,
    reclamadoPrimeraVez: 0,
    reclamadoR: 0,
    efectivo: 0,
    transferencias: 0,
    bold: 0,
    tarjetaDebito: 0,
    tarjetaCredito: 0,
    otros: 0,
    egresos: 0,
    realContado: null,
  };
}

function addIncome(acc: Accumulator, incomeType: PaymentIncomeType, amount: number): void {
  switch (incomeType) {
    case "PRIMERA_VEZ":
      acc.primeraVez += amount;
      break;
    case "R":
      acc.r += amount;
      break;
    case "MEFE":
      acc.mefe += amount;
      break;
    case "RECLAMADO_PRIMERA_VEZ":
      acc.reclamadoPrimeraVez += amount;
      break;
    case "RECLAMADO_R":
      acc.reclamadoR += amount;
      break;
  }
}

function addMethod(acc: Accumulator, method: PaymentMethod, amount: number): void {
  switch (method) {
    case "EFECTIVO":
      acc.efectivo += amount;
      break;
    case "TRANSFERENCIA":
      acc.transferencias += amount;
      break;
    case "BOLD":
      acc.bold += amount;
      break;
    case "TARJETA_DEBITO":
      acc.tarjetaDebito += amount;
      break;
    case "TARJETA_CREDITO":
      acc.tarjetaCredito += amount;
      break;
    case "OTRO":
      acc.otros += amount;
      break;
  }
}

function toRow(date: string, acc: Accumulator): DailyCashboxRow {
  const totalAbonos = round2(acc.primeraVez + acc.r + acc.mefe);
  const totalReclamados = round2(acc.reclamadoPrimeraVez + acc.reclamadoR);
  const totalBancos = round2(
    acc.transferencias + acc.bold + acc.tarjetaDebito + acc.tarjetaCredito,
  );
  const otros = round2(acc.otros);
  const efectivo = round2(acc.efectivo);
  // Venta Bruta is the GROSS PHYSICAL CASH. "Otro" is an ambiguous method (not
  // necessarily cash), so it is subtracted out alongside the electronic methods:
  // Venta Bruta = Total Abonos + Total Reclamados − Total Bancos − Otros == Efectivo.
  // This keeps the cash reconciliation honest: Diferencia compares the counted cash
  // against expected cash only, never against ambiguous "Otro" income.
  const ventaBruta = round2(totalAbonos + totalReclamados - totalBancos - otros);
  const egresos = round2(acc.egresos);
  const ventaNetaEfectivo = round2(ventaBruta - egresos);
  const realContado = acc.realContado === null ? null : round2(acc.realContado);
  const diferencia = realContado === null ? null : round2(realContado - ventaNetaEfectivo);

  return {
    date,
    primeraVez: round2(acc.primeraVez),
    r: round2(acc.r),
    mefe: round2(acc.mefe),
    totalAbonos,
    reclamadoPrimeraVez: round2(acc.reclamadoPrimeraVez),
    reclamadoR: round2(acc.reclamadoR),
    totalReclamados,
    efectivo,
    transferencias: round2(acc.transferencias),
    bold: round2(acc.bold),
    tarjetaDebito: round2(acc.tarjetaDebito),
    tarjetaCredito: round2(acc.tarjetaCredito),
    otros,
    totalBancos,
    ventaBruta,
    egresos,
    ventaNetaEfectivo,
    realContado,
    diferencia,
  };
}

/**
 * Build one cashbox row per calendar day from payment movements, manual expenses
 * and the daily counted cash. Rows are returned most-recent-first. Days that only
 * have an expense or a count (no movements) still produce a row so nothing is lost.
 */
export function buildDailyCashbox(
  movements: CashboxMovement[],
  expenses: CashboxExpense[],
  counts: CashboxCount[],
): DailyCashboxRow[] {
  const byDay = new Map<string, Accumulator>();

  const ensure = (dateKey: string): Accumulator => {
    let acc = byDay.get(dateKey);
    if (!acc) {
      acc = emptyAccumulator();
      byDay.set(dateKey, acc);
    }
    return acc;
  };

  for (const movement of movements) {
    const acc = ensure(movement.dateKey);
    addIncome(acc, movement.incomeType, movement.amount);
    addMethod(acc, movement.method, movement.amount);
  }

  for (const expense of expenses) {
    ensure(expense.dateKey).egresos += expense.amount;
  }

  for (const count of counts) {
    // Last write wins; persistence guarantees one count per day.
    ensure(count.dateKey).realContado = count.amount;
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, acc]) => toRow(date, acc));
}
