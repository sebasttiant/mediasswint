import { NextResponse } from "next/server";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  createOperation,
  listOperations,
  type CreateOperationInput,
  type OperationWithPatient,
  type ServiceResult,
} from "@/lib/operations";
import { parseCreateOperationBody } from "@/lib/operations-input";

type Params = {
  params: Promise<{ id: string }>;
};

export type OperationsCollectionDeps = {
  listOperations: (patientId: string) => Promise<ServiceResult<OperationWithPatient[]>>;
  createOperation: (patientId: string, input: CreateOperationInput) => Promise<ServiceResult<OperationWithPatient>>;
};

const defaultDeps: OperationsCollectionDeps = {
  listOperations,
  createOperation,
};

export async function handleListOperationsRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: OperationsCollectionDeps = defaultDeps,
) {
  const { id: patientId } = await params;
  if (!patientId?.trim()) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
  }

  const result = await deps.listOperations(patientId);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ operations: result.value });
}

export async function handleCreateOperationRequest(
  request: Request,
  { params }: Params,
  _user: AuthUser,
  deps: OperationsCollectionDeps = defaultDeps,
) {
  const { id: patientId } = await params;
  if (!patientId?.trim()) {
    return NextResponse.json({ error: "Patient id is required" }, { status: 400 });
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

  const parsed = parseCreateOperationBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const result = await deps.createOperation(patientId, {
    garmentType: parsed.value.garmentType,
    totalAmount: parsed.value.totalAmount,
    notes: parsed.value.notes,
  });

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(result.value, { status: 201 });
}

export const GET = withAuth<Params>(async (request, ctx, { user }) =>
  handleListOperationsRequest(request, ctx, user),
);

export const POST = withAuth<Params>(async (request, ctx, { user }) =>
  handleCreateOperationRequest(request, ctx, user),
);
