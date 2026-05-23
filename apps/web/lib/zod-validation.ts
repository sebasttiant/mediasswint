import { z, ZodError } from "zod";

export type ValidationError = { field: string; message: string };
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export function parseWithZod<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, errors: zodIssuesToValidationErrors(result.error) };
}

function zodIssuesToValidationErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
