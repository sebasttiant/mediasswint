import {
  Prisma,
  type CommercialOperation,
  type CommercialOperationStatus,
  type PaymentBank,
  type PaymentIncomeType,
  type PaymentMethod,
} from "@prisma/client";

import { recordAudit, toAuditPayload } from "@/lib/audit-log";
import {
  PAYMENT_BANK_VALUES,
  PAYMENT_INCOME_TYPE_VALUES,
  PAYMENT_METHOD_VALUES,
} from "@/lib/cashbox";
import { getPrisma } from "@/lib/prisma";

export type ServiceErrorCode = "NOT_FOUND" | "INVALID_OPERATION" | "FORBIDDEN" | "UNKNOWN";

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceErrorCode };

const OPERATION_STATUS = {
  PRESUPUESTO: "PRESUPUESTO",
  CONFIRMADO: "CONFIRMADO",
  EN_PRODUCCION: "EN_PRODUCCION",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
} as const;

export const OPERATION_QUEUE_KIND = {
  PAYMENT: "PAYMENT",
  PRODUCTION: "PRODUCTION",
} as const;

// Etapa E: additive order metadata. All optional; undefined fields are left
// untouched on update (Prisma ignores undefined). No payment/cashbox semantics.
export type OperationMetadataInput = {
  orderNumber?: string;
  orderedAt?: Date;
  productCode?: string;
  productType?: string;
  quantity?: number;
  invoiceNumber?: string;
  invoiceDate?: Date;
  discount?: Prisma.Decimal;
  exitDate?: Date;
};

export type CreateOperationInput = {
  garmentType?: string;
  totalAmount?: Prisma.Decimal;
  notes?: string;
} & OperationMetadataInput;

export type UpdateOperationInput = {
  status?: CommercialOperationStatus;
  depositPaid?: Prisma.Decimal;
  totalAmount?: Prisma.Decimal;
  garmentType?: string;
  notes?: string;
} & OperationMetadataInput;

export type OperationWithPatient = CommercialOperation & {
  patient: { id: string; fullName: string } | null;
};

// Etapa F: payment dimensions captured when registering a deposit. `bank` is only
// meaningful for TRANSFERENCIA and is normalised to null otherwise.
export type AddDepositPaymentInput = {
  method: PaymentMethod;
  bank?: PaymentBank | null;
  incomeType: PaymentIncomeType;
  note?: string;
};

// Backward-compatible default: callers (or tests) that still send only an amount
// register the deposit as cash / first payment, which keeps the cashbox math
// consistent (cash with a valid income type). The UI always sends explicit values.
export const DEFAULT_DEPOSIT_PAYMENT: AddDepositPaymentInput = {
  method: "EFECTIVO",
  incomeType: "PRIMERA_VEZ",
};

/**
 * A bank/origin is only stored for transfers. For every other method the bank is
 * cleared so we never persist a misleading origin (e.g. a card with a bank).
 */
export function normalizePaymentBank(
  method: PaymentMethod,
  bank?: PaymentBank | null,
): PaymentBank | null {
  return method === "TRANSFERENCIA" ? bank ?? null : null;
}

/**
 * Pure validation for the captured payment dimensions. Guards against unknown
 * enum values reaching the database when input crosses the API boundary.
 */
export function isValidPaymentMovementInput(payment: AddDepositPaymentInput): boolean {
  if (!PAYMENT_METHOD_VALUES.includes(payment.method)) {
    return false;
  }
  if (!PAYMENT_INCOME_TYPE_VALUES.includes(payment.incomeType)) {
    return false;
  }
  if (payment.bank != null && !PAYMENT_BANK_VALUES.includes(payment.bank)) {
    return false;
  }
  return true;
}

export type OperationQueueKind = (typeof OPERATION_QUEUE_KIND)[keyof typeof OPERATION_QUEUE_KIND];

export type OperationalQueueSourceOperation = {
  id: string;
  status: string;
  garmentType: string | null;
  totalAmount: string | null;
  depositPaid: string;
  patientName: string | null;
  patientId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OperationalQueueItem = OperationalQueueSourceOperation & {
  pendingBalance: string;
  actionHref: string;
};

export type OperationalPendingQueue = {
  paymentItems: OperationalQueueItem[];
  productionItems: OperationalQueueItem[];
  paymentCount: number;
  productionCount: number;
};

export function getOperationPendingBalance(
  operation: Pick<OperationalQueueSourceOperation, "totalAmount" | "depositPaid">,
): number {
  return Math.max(Number(operation.totalAmount ?? 0) - Number(operation.depositPaid || 0), 0);
}

export function isValidOperationPaymentUpdate(
  existing: Pick<CommercialOperation, "totalAmount" | "depositPaid">,
  input: Pick<UpdateOperationInput, "totalAmount" | "depositPaid">,
): boolean {
  const effectiveDeposit = input.depositPaid ?? existing.depositPaid;
  const effectiveTotal = input.totalAmount ?? existing.totalAmount;

  if (effectiveDeposit.lt(0)) {
    return false;
  }

  return !effectiveTotal || !effectiveDeposit.gt(effectiveTotal);
}

/**
 * Cross-field validation for the Etapa E order metadata. Pure and side-effect
 * free so it can be unit-tested. On update, `existing` supplies the current
 * persisted values so we validate against the effective (merged) result.
 * Rules:
 *  - quantity must be an integer >= 1 when provided.
 *  - discount must be >= 0 and (when an effective total exists) not exceed it.
 *  - exitDate must not be earlier than orderedAt (effective values).
 */
export function isValidOperationMetadataUpdate(
  existing: Pick<CommercialOperation, "totalAmount" | "discount" | "orderedAt" | "exitDate"> | null,
  input: Pick<UpdateOperationInput, "discount" | "totalAmount" | "orderedAt" | "exitDate" | "quantity">,
): boolean {
  if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity < 1)) {
    return false;
  }

  const effectiveDiscount = input.discount ?? existing?.discount ?? null;
  const effectiveTotal = input.totalAmount ?? existing?.totalAmount ?? null;
  if (effectiveDiscount) {
    if (effectiveDiscount.lt(0)) {
      return false;
    }
    if (effectiveTotal && effectiveDiscount.gt(effectiveTotal)) {
      return false;
    }
  }

  const effectiveOrderedAt = input.orderedAt ?? existing?.orderedAt ?? null;
  const effectiveExitDate = input.exitDate ?? existing?.exitDate ?? null;
  if (
    effectiveOrderedAt &&
    effectiveExitDate &&
    effectiveExitDate.getTime() < effectiveOrderedAt.getTime()
  ) {
    return false;
  }

  return true;
}

function toQueueItem(operation: OperationalQueueSourceOperation): OperationalQueueItem {
  return {
    ...operation,
    pendingBalance: String(getOperationPendingBalance(operation)),
    actionHref: operation.patientId ? `/patients/${operation.patientId}` : "/patients",
  };
}

export function buildOperationalPendingQueue(
  operations: OperationalQueueSourceOperation[],
  limitPerQueue: number,
): OperationalPendingQueue {
  const sortByUpdatedAtDesc = (a: OperationalQueueSourceOperation, b: OperationalQueueSourceOperation) =>
    b.updatedAt.getTime() - a.updatedAt.getTime();

  const paymentOperations = operations
    .filter((operation) => operation.status !== OPERATION_STATUS.CANCELADO && getOperationPendingBalance(operation) > 0)
    .sort(sortByUpdatedAtDesc);
  const productionOperations = operations
    .filter(
      (operation) =>
        operation.status === OPERATION_STATUS.CONFIRMADO || operation.status === OPERATION_STATUS.EN_PRODUCCION,
    )
    .sort(sortByUpdatedAtDesc);

  return {
    paymentItems: paymentOperations.slice(0, limitPerQueue).map(toQueueItem),
    productionItems: productionOperations.slice(0, limitPerQueue).map(toQueueItem),
    paymentCount: paymentOperations.length,
    productionCount: productionOperations.length,
  };
}

export async function fetchOperationalPendingQueue(limitPerQueue = 25): Promise<OperationalPendingQueue> {
  const prisma = getPrisma();
  const operations = await prisma.commercialOperation.findMany({
    where: { status: { not: OPERATION_STATUS.CANCELADO } },
    orderBy: { updatedAt: "desc" },
    include: {
      patient: { select: { id: true, fullName: true } },
    },
  });

  return buildOperationalPendingQueue(
    operations.map((operation) => ({
      id: operation.id,
      status: operation.status,
      garmentType: operation.garmentType,
      totalAmount: operation.totalAmount?.toString() ?? null,
      depositPaid: operation.depositPaid.toString(),
      patientName: operation.patient?.fullName ?? null,
      patientId: operation.patient?.id ?? null,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt,
    })),
    limitPerQueue,
  );
}

/**
 * Lista operaciones de un paciente.
 * Valida que el paciente exista.
 */
export async function listOperations(patientId: string): Promise<ServiceResult<OperationWithPatient[]>> {
  try {
    const prisma = getPrisma();
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return { ok: false, error: "NOT_FOUND" };
    }

    const operations = await prisma.commercialOperation.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
    });

    return { ok: true, value: operations };
  } catch (error) {
    console.error("listOperations error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Crea una nueva operación para un paciente.
 * Valida que el paciente exista.
 */
export async function createOperation(
  patientId: string,
  input: CreateOperationInput
): Promise<ServiceResult<OperationWithPatient>> {
  try {
    const prisma = getPrisma();
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return { ok: false, error: "NOT_FOUND" };
    }

    if (!isValidOperationMetadataUpdate(null, input)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    const operation = await prisma.commercialOperation.create({
      data: {
        patientId,
        garmentType: input.garmentType,
        totalAmount: input.totalAmount,
        notes: input.notes,
        status: "PRESUPUESTO",
        depositPaid: new Prisma.Decimal(0),
        orderNumber: input.orderNumber,
        orderedAt: input.orderedAt,
        productCode: input.productCode,
        productType: input.productType,
        quantity: input.quantity ?? 1,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        discount: input.discount,
        exitDate: input.exitDate,
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
    });

    await recordAudit({
      action: "CREATE",
      entityType: "CommercialOperation",
      entityId: operation.id,
      diff: { after: toAuditPayload(operation) },
    });

    return { ok: true, value: operation };
  } catch (error) {
    console.error("createOperation error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Actualiza una operación.
 * CRÍTICO: Valida que la operación pertenezca al patientId informado.
 * Si no pertenece → NOT_FOUND (404, no revelar existencia).
 */
export async function updateOperation(
  patientId: string,
  operationId: string,
  input: UpdateOperationInput
): Promise<ServiceResult<OperationWithPatient>> {
  try {
    const prisma = getPrisma();
    // Primero verificar que la operación pertenece al paciente
    const existing = await prisma.commercialOperation.findFirst({
      where: {
        id: operationId,
        patientId,
      },
    });

    if (!existing) {
      return { ok: false, error: "NOT_FOUND" };
    }

    // Validaciones de negocio
    // CANCELADO is terminal: no field can be mutated after cancellation.
    if (existing.status === "CANCELADO") {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    if (!isValidOperationPaymentUpdate(existing, input)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    if (!isValidOperationMetadataUpdate(existing, input)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    const operation = await prisma.commercialOperation.update({
      where: { id: operationId },
      data: {
        status: input.status,
        depositPaid: input.depositPaid,
        totalAmount: input.totalAmount,
        garmentType: input.garmentType,
        notes: input.notes,
        orderNumber: input.orderNumber,
        orderedAt: input.orderedAt,
        productCode: input.productCode,
        productType: input.productType,
        quantity: input.quantity,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        discount: input.discount,
        exitDate: input.exitDate,
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
    });

    await recordAudit({
      action: "UPDATE",
      entityType: "CommercialOperation",
      entityId: operation.id,
      diff: { before: toAuditPayload(existing), after: toAuditPayload(operation) },
    });

    return { ok: true, value: operation };
  } catch (error) {
    console.error("updateOperation error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Agrega un depósito/abono a una operación.
 * CRÍTICO: Valida pertenencia igual que updateOperation.
 * Usa transacción interactiva con Serializable para evitar TOCTOU.
 */
export async function addDeposit(
  patientId: string,
  operationId: string,
  amount: Prisma.Decimal,
  payment: AddDepositPaymentInput = DEFAULT_DEPOSIT_PAYMENT,
): Promise<ServiceResult<OperationWithPatient>> {
  try {
    const prisma = getPrisma();

    // A deposit must move money: reject zero (and negative) at the service layer,
    // not only at the route, so no empty ledger movement can ever be created.
    if (amount.lte(0)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    if (!isValidPaymentMovementInput(payment)) {
      return { ok: false, error: "INVALID_OPERATION" };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.commercialOperation.findFirst({
          where: {
            id: operationId,
            patientId,
          },
        });

        if (!existing) {
          return { ok: false as const, error: "NOT_FOUND" as const };
        }

        if (existing.status === "CANCELADO") {
          return { ok: false as const, error: "INVALID_OPERATION" as const };
        }

        if (existing.totalAmount) {
          const newTotal = existing.depositPaid.add(amount);
          if (newTotal.gt(existing.totalAmount)) {
            return { ok: false as const, error: "INVALID_OPERATION" as const };
          }
        }

        const updated = await tx.commercialOperation.update({
          where: { id: operationId },
          data: {
            depositPaid: { increment: amount },
          },
          include: {
            patient: {
              select: { id: true, fullName: true },
            },
          },
        });

        // Source of truth for Caja y Finanzas: one ledger movement per deposit,
        // written in the same Serializable transaction as the cached total so the
        // two can never diverge for new deposits.
        // TODO (slice 2): support an editable payment date. Today paidAt defaults to
        // now(); a deposit registered a day late lands in the wrong cashbox day.
        await tx.paymentMovement.create({
          data: {
            operationId,
            patientId,
            amount,
            method: payment.method,
            bank: normalizePaymentBank(payment.method, payment.bank),
            incomeType: payment.incomeType,
            note: payment.note,
          },
        });

        return { ok: true as const, value: updated, before: existing };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.ok) {
      await recordAudit({
        action: "UPDATE",
        entityType: "CommercialOperation",
        entityId: result.value.id,
        diff: { before: toAuditPayload(result.before), after: toAuditPayload(result.value) },
      });
      return { ok: true, value: result.value };
    }
    return result;
  } catch (error) {
    console.error("addDeposit error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Obtiene una operación específica.
 * CRÍTICO: Valida pertenencia al paciente.
 */
export async function getOperation(
  patientId: string,
  operationId: string
): Promise<ServiceResult<OperationWithPatient>> {
  try {
    const prisma = getPrisma();
    const operation = await prisma.commercialOperation.findFirst({
      where: {
        id: operationId,
        patientId,
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!operation) {
      return { ok: false, error: "NOT_FOUND" };
    }

    return { ok: true, value: operation };
  } catch (error) {
    console.error("getOperation error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}
