import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { requireActiveUserFromRequest, type AuthUser } from "@/lib/auth";
import {
  addDeposit,
  type OperationWithPatient,
  type ServiceResult,
} from "@/lib/operations";

type Params = {
  params: Promise<{ id: string; operationId: string }>;
};

export type DepositDeps = {
  requireActiveUser: (request: Request) => Promise<AuthUser | null>;
  addDeposit: (patientId: string, operationId: string, amount: Prisma.Decimal) => Promise<ServiceResult<OperationWithPatient>>;
};

const defaultDeps: DepositDeps = {
  requireActiveUser: requireActiveUserFromRequest,
  addDeposit,
};

export async function handleAddDepositRequest(
  request: Request,
  { params }: Params,
  deps: DepositDeps = defaultDeps,
) {
  const user = await deps.requireActiveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: patientId, operationId } = await params;
  if (!patientId?.trim() || !operationId?.trim()) {
    return NextResponse.json({ error: "Patient id and operation id are required" }, { status: 400 });
  }

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

  const input = body as { amount?: string };

  if (input.amount === undefined) {
    return NextResponse.json(
      { errors: [{ field: "amount", message: "amount is required" }] },
      { status: 400 },
    );
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.amount)) {
    return NextResponse.json(
      { errors: [{ field: "amount", message: "must be a positive number" }] },
      { status: 400 },
    );
  }

  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) {
    return NextResponse.json(
      { errors: [{ field: "amount", message: "must be a positive number" }] },
      { status: 400 },
    );
  }

  const result = await deps.addDeposit(patientId, operationId, amount);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Operation not found" }, { status: 404 });
    }
    if (result.error === "INVALID_OPERATION") {
      return NextResponse.json(
        { error: "Invalid deposit: negative amount or exceeds total" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value);
}

export async function POST(request: Request, context: Params) {
  return handleAddDepositRequest(request, context);
}
