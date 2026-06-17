import { NextResponse } from "next/server";

import { withAuth } from "@/lib/with-auth";
import { upsertDailyCashCount, type UpsertCashCountInput } from "@/lib/finance";
import type { ServiceResult } from "@/lib/operations";

export type CashCountDeps = {
  upsertDailyCashCount: (input: UpsertCashCountInput) => Promise<ServiceResult<{ id: string }>>;
};

const defaultDeps: CashCountDeps = { upsertDailyCashCount };

export async function handleUpsertCashCountRequest(
  request: Request,
  deps: CashCountDeps = defaultDeps,
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

  const input = body as Partial<UpsertCashCountInput>;
  if (typeof input.date !== "string" || typeof input.countedAmount !== "string") {
    return NextResponse.json(
      { errors: [{ field: "body", message: "date and countedAmount are required" }] },
      { status: 400 },
    );
  }

  const result = await deps.upsertDailyCashCount({
    date: input.date,
    countedAmount: input.countedAmount,
    note: typeof input.note === "string" ? input.note : undefined,
  });

  if (!result.ok) {
    if (result.error === "INVALID_OPERATION") {
      return NextResponse.json(
        { error: "Invalid count: check date and amount (>= 0)" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value);
}

export const POST = withAuth(async (request) => handleUpsertCashCountRequest(request));
