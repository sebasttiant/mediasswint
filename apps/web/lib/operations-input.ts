import { z } from "zod";
import { Prisma, type CommercialOperationStatus } from "@prisma/client";

import { parseWithZod, type ValidationResult } from "./zod-validation";

const VALID_STATUSES = [
  "PRESUPUESTO",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "ENTREGADO",
  "CANCELADO",
] as const satisfies readonly CommercialOperationStatus[];

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function decimalField(fieldName: string) {
  return z
    .string({ error: `${fieldName} must be a string` })
    .refine((v) => DECIMAL_PATTERN.test(v), { error: "must be a positive number" })
    .transform((v) => new Prisma.Decimal(v));
}

export type CreateOperationBody = {
  garmentType: string;
  totalAmount?: Prisma.Decimal;
  notes?: string;
};

export const OperationCreateSchema = z.object({
  garmentType: z
    .string({ error: "garmentType is required" })
    .min(1, { error: "garmentType is required" })
    .max(200, { error: "must be at most 200 characters" })
    .transform((v) => v.trim()),
  totalAmount: decimalField("totalAmount").optional(),
  notes: z
    .string()
    .max(2000, { error: "must be at most 2000 characters" })
    .transform((v) => (v.trim() || undefined))
    .optional(),
});

export type UpdateOperationBody = {
  status?: CommercialOperationStatus;
  depositPaid?: Prisma.Decimal;
  totalAmount?: Prisma.Decimal;
  garmentType?: string;
  notes?: string;
};

const OperationUpdateSchemaBase = z.object({
  status: z
    .enum(VALID_STATUSES, { error: "invalid status value" })
    .optional(),
  depositPaid: decimalField("depositPaid").optional(),
  totalAmount: decimalField("totalAmount").optional(),
  garmentType: z
    .string()
    .max(200, { error: "must be at most 200 characters" })
    .transform((v) => v.trim() || undefined)
    .optional(),
  notes: z
    .string()
    .max(2000, { error: "must be at most 2000 characters" })
    .transform((v) => v.trim() || undefined)
    .optional(),
});

export const OperationUpdateSchema = OperationUpdateSchemaBase.superRefine((data, ctx) => {
  const hasFields = Object.values(data).some((v) => v !== undefined);
  if (!hasFields) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "no fields to update",
      path: ["body"],
    });
  }
});

export type DepositBody = {
  amount: Prisma.Decimal;
};

export const DepositSchema = z.object({
  amount: z
    .string({ error: "amount is required" })
    .refine((v) => DECIMAL_PATTERN.test(v), { error: "must be a positive number" })
    .transform((v) => new Prisma.Decimal(v))
    .refine((d) => d.gt(0), { error: "must be a positive number" }),
});

export function parseCreateOperationBody(body: unknown): ValidationResult<CreateOperationBody> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: [{ field: "body", message: "invalid body shape" }] };
  }
  return parseWithZod(OperationCreateSchema, body) as ValidationResult<CreateOperationBody>;
}

export function parseUpdateOperationBody(body: unknown): ValidationResult<UpdateOperationBody> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: [{ field: "body", message: "invalid body shape" }] };
  }
  return parseWithZod(OperationUpdateSchemaBase, body) as ValidationResult<UpdateOperationBody>;
}

export function parseDepositBody(body: unknown): ValidationResult<DepositBody> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: [{ field: "body", message: "invalid body shape" }] };
  }
  return parseWithZod(DepositSchema, body) as ValidationResult<DepositBody>;
}
