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

// The business runs in Colombia, so every exported "generated at" stamp must read in
// Bogota time regardless of where the server runs. Pinning the time zone here (instead
// of relying on toLocaleString's host default) keeps PDF, Excel and tests deterministic.
const REPORT_TIME_ZONE = "America/Bogota";

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  timeZone: REPORT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Render an ISO timestamp as DD/MM/YYYY, HH:mm in Colombia (Bogota) time. Used for the
 * "Generado" line in every export so the stamp never drifts with the server's timezone.
 */
export function formatTimestamp(iso: string): string {
  return `${TIMESTAMP_FORMATTER.format(new Date(iso))} (hora Colombia)`;
}
