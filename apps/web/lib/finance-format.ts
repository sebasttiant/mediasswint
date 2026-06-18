// Shared, framework-free formatting for the finance module. Both the on-screen
// client and the server-side exports (Excel / PDF) import these so a label rename or
// date-format tweak can never desync the export from what the operator sees.

import { PAYMENT_BANKS, PAYMENT_INCOME_TYPES, PAYMENT_METHODS } from "@/lib/cashbox";

export const METHOD_LABELS = new Map(PAYMENT_METHODS.map((m) => [m.value, m.label]));
export const INCOME_TYPE_LABELS = new Map(PAYMENT_INCOME_TYPES.map((t) => [t.value, t.label]));
export const BANK_LABELS = new Map(PAYMENT_BANKS.map((b) => [b.value, b.label]));

/** Render a YYYY-MM-DD key as DD/MM/YYYY without timezone surprises. */
export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}
