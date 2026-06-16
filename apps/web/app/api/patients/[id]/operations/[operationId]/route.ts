import { NextResponse } from "next/server";
import { Prisma, type CommercialOperationStatus } from "@prisma/client";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  getOperation,
  updateOperation,
  type OperationWithPatient,
  type ServiceResult,
  type UpdateOperationInput,
} from "@/lib/operations";
import { parseOperationMetadataInput } from "@/lib/operation-metadata";

type Params = {
  params: Promise<{ id: string; operationId: string }>;
};

const VALID_STATUSES: CommercialOperationStatus[] = [
  "PRESUPUESTO",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "ENTREGADO",
  "CANCELADO",
];

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid body shape" }] },
      { status: 400 },
    );
  }

  const input = body as {
    status?: string;
    depositPaid?: string;
    totalAmount?: string;
    garmentType?: string;
    notes?: string;
  };

  const updateData: UpdateOperationInput = {};

  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status as CommercialOperationStatus)) {
      return NextResponse.json(
        { errors: [{ field: "status", message: "invalid status value" }] },
        { status: 400 },
      );
    }
    updateData.status = input.status as CommercialOperationStatus;
  }

  if (input.depositPaid !== undefined) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.depositPaid)) {
      return NextResponse.json(
        { errors: [{ field: "depositPaid", message: "must be a non-negative number" }] },
        { status: 400 },
      );
    }
    updateData.depositPaid = new Prisma.Decimal(input.depositPaid);
  }

  if (input.totalAmount !== undefined) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input.totalAmount)) {
      return NextResponse.json(
        { errors: [{ field: "totalAmount", message: "must be a non-negative number" }] },
        { status: 400 },
      );
    }
    updateData.totalAmount = new Prisma.Decimal(input.totalAmount);
  }

  if (input.garmentType !== undefined) {
    if (input.garmentType.length > 200) {
      return NextResponse.json(
        { errors: [{ field: "garmentType", message: "must be at most 200 characters" }] },
        { status: 400 },
      );
    }
    updateData.garmentType = input.garmentType.trim() || undefined;
  }

  if (input.notes !== undefined) {
    if (input.notes.length > 2000) {
      return NextResponse.json(
        { errors: [{ field: "notes", message: "must be at most 2000 characters" }] },
        { status: 400 },
      );
    }
    updateData.notes = input.notes.trim() || undefined;
  }

  const metadata = parseOperationMetadataInput(input as Record<string, unknown>);
  if (!metadata.ok) {
    return NextResponse.json(
      { errors: [{ field: metadata.field, message: metadata.message }] },
      { status: 400 },
    );
  }
  Object.assign(updateData, metadata.value);

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
