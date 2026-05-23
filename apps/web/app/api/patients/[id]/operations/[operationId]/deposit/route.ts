import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  addDeposit,
  type OperationWithPatient,
  type ServiceResult,
} from "@/lib/operations";
import { parseDepositBody } from "@/lib/operations-input";

type Params = {
  params: Promise<{ id: string; operationId: string }>;
};

export type DepositDeps = {
  addDeposit: (patientId: string, operationId: string, amount: Prisma.Decimal) => Promise<ServiceResult<OperationWithPatient>>;
};

const defaultDeps: DepositDeps = {
  addDeposit,
};

export async function handleAddDepositRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: DepositDeps = defaultDeps,
) {
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

  const parsed = parseDepositBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const result = await deps.addDeposit(patientId, operationId, parsed.value.amount);

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

export const POST = withAuth<Params>(async (request, ctx, { user }) =>
  handleAddDepositRequest(request, ctx, user),
);
