import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  createOperation,
  listOperations,
  type CreateOperationInput,
  type OperationWithPatient,
  type ServiceResult,
} from "@/lib/operations";
import { parseOperationMetadataInput } from "@/lib/operation-metadata";

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid body shape" }] },
      { status: 400 },
    );
  }

  const input = body as {
    garmentType?: string;
    totalAmount?: string;
    notes?: string;
  };

  if (!input.garmentType?.trim()) {
    return NextResponse.json(
      { errors: [{ field: "garmentType", message: "garmentType is required" }] },
      { status: 400 },
    );
  }

  if (input.garmentType.length > 200) {
    return NextResponse.json(
      { errors: [{ field: "garmentType", message: "must be at most 200 characters" }] },
      { status: 400 },
    );
  }

  if (input.notes && input.notes.length > 2000) {
    return NextResponse.json(
      { errors: [{ field: "notes", message: "must be at most 2000 characters" }] },
      { status: 400 },
    );
  }

  let totalAmount: Prisma.Decimal | undefined;

  if (input.totalAmount !== undefined) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.totalAmount)) {
      return NextResponse.json(
        { errors: [{ field: "totalAmount", message: "must be a positive number" }] },
        { status: 400 },
      );
    }
    totalAmount = new Prisma.Decimal(input.totalAmount);
  }

  const metadata = parseOperationMetadataInput(input as Record<string, unknown>);
  if (!metadata.ok) {
    return NextResponse.json(
      { errors: [{ field: metadata.field, message: metadata.message }] },
      { status: 400 },
    );
  }

  const result = await deps.createOperation(patientId, {
    garmentType: input.garmentType.trim(),
    totalAmount,
    notes: input.notes?.trim() || undefined,
    ...metadata.value,
  });

  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (result.error === "INVALID_OPERATION") {
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
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
