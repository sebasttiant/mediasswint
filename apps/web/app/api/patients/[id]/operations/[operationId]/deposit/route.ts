import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { type AuthUser } from "@/lib/auth";
import { withAuth } from "@/lib/with-auth";
import {
  addDeposit,
  type AddDepositPaymentInput,
  type OperationWithPatient,
  type ServiceResult,
} from "@/lib/operations";
import {
  PAYMENT_BANK_VALUES,
  PAYMENT_INCOME_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
  type PaymentBank,
  type PaymentIncomeType,
  type PaymentMethod,
} from "@/lib/cashbox";

type Params = {
  params: Promise<{ id: string; operationId: string }>;
};

export type DepositDeps = {
  addDeposit: (
    patientId: string,
    operationId: string,
    amount: Prisma.Decimal,
    payment?: AddDepositPaymentInput,
  ) => Promise<ServiceResult<OperationWithPatient>>;
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { errors: [{ field: "body", message: "invalid body shape" }] },
      { status: 400 },
    );
  }

  const input = body as {
    amount?: string;
    method?: string;
    bank?: string | null;
    incomeType?: string;
    note?: string;
  };

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

  // Payment dimensions are optional for backward compatibility; when present they
  // must be valid enum members. Method/income default to cash / first payment.
  const method = (input.method ?? "EFECTIVO") as PaymentMethod;
  if (!PAYMENT_METHOD_VALUES.includes(method)) {
    return NextResponse.json(
      { errors: [{ field: "method", message: "invalid payment method" }] },
      { status: 400 },
    );
  }

  const incomeType = (input.incomeType ?? "PRIMERA_VEZ") as PaymentIncomeType;
  if (!PAYMENT_INCOME_TYPE_VALUES.includes(incomeType)) {
    return NextResponse.json(
      { errors: [{ field: "incomeType", message: "invalid income type" }] },
      { status: 400 },
    );
  }

  let bank: PaymentBank | null = null;
  if (input.bank != null && input.bank !== "") {
    if (!PAYMENT_BANK_VALUES.includes(input.bank as PaymentBank)) {
      return NextResponse.json(
        { errors: [{ field: "bank", message: "invalid bank" }] },
        { status: 400 },
      );
    }
    bank = input.bank as PaymentBank;
  }

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : undefined;

  const result = await deps.addDeposit(patientId, operationId, amount, {
    method,
    bank,
    incomeType,
    note,
  });

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
