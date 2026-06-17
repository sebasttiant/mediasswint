import { NextResponse } from "next/server";

import { withAuth } from "@/lib/with-auth";
import { createExpense, type CreateExpenseInput } from "@/lib/finance";
import type { ServiceResult } from "@/lib/operations";

export type ExpensesDeps = {
  createExpense: (input: CreateExpenseInput) => Promise<ServiceResult<{ id: string }>>;
};

const defaultDeps: ExpensesDeps = { createExpense };

export async function handleCreateExpenseRequest(
  request: Request,
  deps: ExpensesDeps = defaultDeps,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid JSON body" }] },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid body shape" }] },
      { status: 400 },
    );
  }

  const input = body as Partial<CreateExpenseInput>;
  if (
    typeof input.date !== "string" ||
    typeof input.amount !== "string" ||
    typeof input.concept !== "string"
  ) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "date, amount and concept are required" }] },
      { status: 400 },
    );
  }

  const result = await deps.createExpense({
    date: input.date,
    amount: input.amount,
    concept: input.concept,
    note: typeof input.note === "string" ? input.note : undefined,
  });

  if (!result.ok) {
    if (result.error === "INVALID_OPERATION") {
      return NextResponse.json(
        { error: "Invalid expense: check date, amount (> 0) and concept" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 201 });
}

export const POST = withAuth(async (request) => handleCreateExpenseRequest(request));
