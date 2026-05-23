import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  getOperation,
  updateOperation,
  type OperationWithPatient,
  type ServiceResult,
  type UpdateOperationInput,
} from "@/lib/operations";
import { parseUpdateOperationBody } from "@/lib/operations-input";

type Params = {
  params: Promise<{ id: string; operationId: string }>;
};

export type OperationDeps = {
  getOperation: (patientId: string, operationId: string) => Promise<ServiceResult<OperationWithPatient>>;
  updateOperation: (patientId: string, operationId: string, input: UpdateOperationInput) => Promise<ServiceResult<OperationWithPatient>>;
};

const defaultDeps: OperationDeps = {
  getOperation,
  updateOperation,
};

export async function handleGetOperationRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: OperationDeps = defaultDeps,
) {
  const { id: patientId, operationId } = await params;
  if (!patientId?.trim() || !operationId?.trim()) {
    return NextResponse.json({ error: "Patient id and operation id are required" }, { status: 400 });
  }

  const result = await deps.getOperation(patientId, operationId);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Operation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value);
}

export async function handleUpdateOperationRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: OperationDeps = defaultDeps,
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

  const parsed = parseUpdateOperationBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const updateData: UpdateOperationInput = parsed.value;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "no fields to update" }] },
      { status: 400 },
    );
  }

  const result = await deps.updateOperation(patientId, operationId, updateData);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Operation not found" }, { status: 404 });
    }
    if (result.error === "INVALID_OPERATION") {
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value);
}

export const GET = withAuth<Params>(async (request, ctx, { user }) =>
  handleGetOperationRequest(request, ctx, user),
);

export const PATCH = withAuth<Params>(async (request, ctx, { user }) =>
  handleUpdateOperationRequest(request, ctx, user),
);
