import { Prisma } from "@prisma/client";

import {
  buildDailyCashbox,
  filterDailyRowsByRange,
  toCashboxDateKey,
  type CashboxCount,
  type CashboxExpense,
  type CashboxMovement,
  type DailyCashboxRow,
} from "@/lib/cashbox";
import { getPrisma } from "@/lib/prisma";
import type { ServiceResult } from "@/lib/operations";

// Expenses and the daily count are calendar-date values (no time-of-day). They are
// stored as midnight UTC of the chosen day and keyed back in UTC, so a date never
// drifts to a neighbouring day. Payment movements, by contrast, are real instants
// and are keyed in the clinic timezone (see toCashboxDateKey).
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnlyUTC(value: string): Date | null {
  if (!DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateOnlyKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The clinic-timezone calendar day for a given instant, formatted for a <input
 * type="date">. Used to default the expense / cash-count forms to "today".
 */
export function toCashboxDateKeyForForm(date: Date): string {
  return toCashboxDateKey(date);
}

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export type CreateExpenseInput = {
  date: string; // YYYY-MM-DD
  amount: string; // decimal string
  concept: string;
  note?: string;
};

export type UpsertCashCountInput = {
  date: string; // YYYY-MM-DD
  countedAmount: string; // decimal string
  note?: string;
};

const POSITIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function isValidExpenseInput(input: CreateExpenseInput): boolean {
  if (parseDateOnlyUTC(input.date) === null) return false;
  if (!input.concept.trim()) return false;
  if (!POSITIVE_DECIMAL.test(input.amount)) return false;
  return new Prisma.Decimal(input.amount).gt(0);
}

export function isValidCashCountInput(input: UpsertCashCountInput): boolean {
  if (parseDateOnlyUTC(input.date) === null) return false;
  if (!POSITIVE_DECIMAL.test(input.countedAmount)) return false;
  return new Prisma.Decimal(input.countedAmount).gte(0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Coarse DB bounds for a cashbox date range. PaymentMovement.paidAt is a real
 * instant keyed in the clinic timezone (America/Bogota, UTC-5), so a payment made
 * late on the `to` day rolls into the next UTC day. To never drop it, the exclusive
 * upper bound is padded to `to + 2 days` at midnight UTC; the precise per-day
 * membership is then enforced in memory by filterDailyRowsByRange on the Bogota key.
 */
export function cashboxQueryBounds(from: string, to: string): { gte: Date; lt: Date } {
  const gte = parseDateOnlyUTC(from) ?? new Date(`${from}T00:00:00.000Z`);
  const toMidnight = parseDateOnlyUTC(to) ?? new Date(`${to}T00:00:00.000Z`);
  const lt = new Date(toMidnight.getTime() + 2 * DAY_MS);
  return { gte, lt };
}

/**
 * Build the daily cashbox from the ledger. When a `from`/`to` range is given, the DB
 * query is bounded (so we never load all history) and the result is filtered to the
 * exact Bogota days requested. With no range, all history is returned (used by tests
 * and tooling, not the screen). Legacy deposits never appear here because they are
 * not in the PaymentMovement table.
 *
 * Only date/range narrows this view. Method and patient filters belong to the
 * movement-level detail, never to the daily reconciliation.
 */
export async function fetchDailyCashbox(options?: {
  from?: string;
  to?: string;
}): Promise<DailyCashboxRow[]> {
  const prisma = getPrisma();
  const range = options?.from && options?.to ? { from: options.from, to: options.to } : null;
  const bounds = range ? cashboxQueryBounds(range.from, range.to) : null;

  const [movements, expenses, counts] = await Promise.all([
    prisma.paymentMovement.findMany({
      where: bounds ? { paidAt: { gte: bounds.gte, lt: bounds.lt } } : undefined,
      select: { amount: true, method: true, incomeType: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: bounds ? { date: { gte: bounds.gte, lt: bounds.lt } } : undefined,
      select: { amount: true, date: true },
    }),
    prisma.dailyCashCount.findMany({
      where: bounds ? { date: { gte: bounds.gte, lt: bounds.lt } } : undefined,
      select: { countedAmount: true, date: true },
    }),
  ]);

  const movementRows: CashboxMovement[] = movements.map((m) => ({
    amount: decimalToNumber(m.amount),
    method: m.method,
    incomeType: m.incomeType,
    dateKey: toCashboxDateKey(m.paidAt),
  }));

  const expenseRows: CashboxExpense[] = expenses.map((e) => ({
    amount: decimalToNumber(e.amount),
    dateKey: dateOnlyKeyUTC(e.date),
  }));

  const countRows: CashboxCount[] = counts.map((c) => ({
    amount: decimalToNumber(c.countedAmount),
    dateKey: dateOnlyKeyUTC(c.date),
  }));

  const rows = buildDailyCashbox(movementRows, expenseRows, countRows);
  return range ? filterDailyRowsByRange(rows, range.from, range.to) : rows;
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    if (!isValidExpenseInput(input)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }
    const date = parseDateOnlyUTC(input.date)!;
    const prisma = getPrisma();
    const expense = await prisma.expense.create({
      data: {
        date,
        amount: new Prisma.Decimal(input.amount),
        concept: input.concept.trim(),
        note: input.note?.trim() ? input.note.trim() : null,
      },
      select: { id: true },
    });
    return { ok: true, value: expense };
  } catch (error) {
    console.error("createExpense error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Upsert the counted cash for a day. One row per calendar date, so re-counting the
 * same day overwrites the previous value instead of stacking rows.
 */
export async function upsertDailyCashCount(
  input: UpsertCashCountInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    if (!isValidCashCountInput(input)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }
    const date = parseDateOnlyUTC(input.date)!;
    const amount = new Prisma.Decimal(input.countedAmount);
    const note = input.note?.trim() ? input.note.trim() : null;
    const prisma = getPrisma();
    const count = await prisma.dailyCashCount.upsert({
      where: { date },
      update: { countedAmount: amount, note },
      create: { date, countedAmount: amount, note },
      select: { id: true },
    });
    return { ok: true, value: count };
  } catch (error) {
    console.error("upsertDailyCashCount error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}
