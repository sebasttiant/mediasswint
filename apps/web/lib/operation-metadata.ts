import { Prisma } from "@prisma/client";

import type { OperationMetadataInput } from "@/lib/operations";

/**
 * HTTP-layer parsing/format-validation for the Etapa E order metadata, shared
 * by the POST and PATCH operation routes. It only handles shape/format (types,
 * trims, max lengths, numeric/date parsing). Cross-field business rules
 * (discount <= total, exitDate >= orderedAt) live in the service layer via
 * `isValidOperationMetadataUpdate`, because they may depend on the existing row.
 *
 * Empty/whitespace strings are treated as "absent" (field left untouched).
 */
const NON_NEGATIVE_NUMERIC = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const STRING_FIELDS: ReadonlyArray<
  [field: "orderNumber" | "productCode" | "productType" | "invoiceNumber", maxLen: number]
> = [
  ["orderNumber", 32],
  ["productCode", 64],
  ["productType", 64],
  ["invoiceNumber", 64],
];

const DATE_FIELDS: ReadonlyArray<"orderedAt" | "invoiceDate" | "exitDate"> = [
  "orderedAt",
  "invoiceDate",
  "exitDate",
];
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export type MetadataParseResult =
  | { ok: true; value: OperationMetadataInput }
  | { ok: false; field: string; message: string };

function parseMetadataDate(rawValue: string): Date {
  const dateOnly = DATE_ONLY.exec(rawValue);
  if (!dateOnly) {
    return new Date(Number.NaN);
  }

  const [, year, month, day] = dateOnly;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const parsed = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber, 12, 0, 0));
  if (
    parsed.getUTCFullYear() !== yearNumber ||
    parsed.getUTCMonth() !== monthNumber - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return new Date(Number.NaN);
  }

  return parsed;
}

export function parseOperationMetadataInput(raw: Record<string, unknown>): MetadataParseResult {
  const value: OperationMetadataInput = {};

  for (const [field, maxLen] of STRING_FIELDS) {
    const rawValue = raw[field];
    if (rawValue === undefined || rawValue === null) continue;
    if (typeof rawValue !== "string") {
      return { ok: false, field, message: `${field} must be a string` };
    }
    const trimmed = rawValue.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > maxLen) {
      return { ok: false, field, message: `must be at most ${maxLen} characters` };
    }
    value[field] = trimmed;
  }

  if (raw.quantity !== undefined && raw.quantity !== null && raw.quantity !== "") {
    const quantity = typeof raw.quantity === "number" ? raw.quantity : Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, field: "quantity", message: "must be an integer >= 1" };
    }
    value.quantity = quantity;
  }

  if (raw.discount !== undefined && raw.discount !== null && raw.discount !== "") {
    const discount = String(raw.discount);
    if (!NON_NEGATIVE_NUMERIC.test(discount)) {
      return { ok: false, field: "discount", message: "must be a non-negative number" };
    }
    value.discount = new Prisma.Decimal(discount);
  }

  for (const field of DATE_FIELDS) {
    const rawValue = raw[field];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;
    if (typeof rawValue !== "string") {
      return { ok: false, field, message: `${field} must be a date string` };
    }
    const parsed = parseMetadataDate(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, field, message: "must be a valid date" };
    }
    value[field] = parsed;
  }

  return { ok: true, value };
}
