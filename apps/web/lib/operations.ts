import { Prisma, type CommercialOperation, type CommercialOperationStatus } from "@prisma/client";

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

export type CreateOperationInput = {
  garmentType?: string;
  totalAmount?: Prisma.Decimal;
  notes?: string;
};

export type UpdateOperationInput = {
  status?: CommercialOperationStatus;
  depositPaid?: Prisma.Decimal;
  totalAmount?: Prisma.Decimal;
  garmentType?: string;
  notes?: string;
};

export type OperationWithPatient = CommercialOperation & {
  patient: { id: string; fullName: string } | null;
};

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

    const operation = await prisma.commercialOperation.create({
      data: {
        patientId,
        garmentType: input.garmentType,
        totalAmount: input.totalAmount,
        notes: input.notes,
        status: "PRESUPUESTO",
        depositPaid: new Prisma.Decimal(0),
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
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
    if (input.status) {
      // CANCELADO es terminal, no se puede cambiar
      if (existing.status === "CANCELADO") {
        return { ok: false, error: "INVALID_OPERATION" };
      }
    }

    if (!isValidOperationPaymentUpdate(existing, input)) {
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
      },
      include: {
        patient: {
          select: { id: true, fullName: true },
        },
      },
    });

    return { ok: true, value: operation };
  } catch (error) {
    console.error("updateOperation error:", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * Agrega un depósito/seña a una operación.
 * CRÍTICO: Valida pertenencia igual que updateOperation.
 * Usa transacción interactiva con Serializable para evitar TOCTOU.
 */
export async function addDeposit(
  patientId: string,
  operationId: string,
  amount: Prisma.Decimal
): Promise<ServiceResult<OperationWithPatient>> {
  try {
    const prisma = getPrisma();

    if (amount.lt(0)) {
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

        return { ok: true as const, value: updated };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
