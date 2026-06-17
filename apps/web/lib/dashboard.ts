import { getPrisma } from "@/lib/prisma";

type DashboardRepository = {
  getTotalPatients(): Promise<number>;
  getPatientsCreatedToday(): Promise<number>;
  getActiveOperationsCount(): Promise<number>;
  getOpenMeasurementDraftsCount(): Promise<number>;
  getCompletedMeasurementsTodayCount(): Promise<number>;
  getTotalDeposits(): Promise<string>;
  getTotalPendingBalance(): Promise<string>;
  getLatestPatients(limit: number): Promise<DashboardPatient[]>;
  getLatestOperations(limit: number): Promise<DashboardOperation[]>;
  getLatestMeasurements(limit: number): Promise<DashboardMeasurement[]>;
  getPendingWork(limit: number): Promise<DashboardPendingWork>;
};

const MEASUREMENT_STATUS = {
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  VOID: "VOID",
} as const;

const OPERATION_STATUS = {
  PRESUPUESTO: "PRESUPUESTO",
  CONFIRMADO: "CONFIRMADO",
  EN_PRODUCCION: "EN_PRODUCCION",
  ENTREGADO: "ENTREGADO",
  CANCELADO: "CANCELADO",
} as const;

const PENDING_WORK_KIND = {
  PAYMENT: "PAYMENT",
  PRODUCTION: "PRODUCTION",
  MEASUREMENT: "MEASUREMENT",
} as const;

export type DashboardPatient = {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  createdAt: Date;
};

export type DashboardOperation = {
  id: string;
  status: string;
  garmentType: string | null;
  totalAmount: string;
  depositPaid: string;
  patientName: string | null;
  patientId: string | null;
  createdAt: Date;
};

export type DashboardMeasurement = {
  id: string;
  status: string;
  measuredAt: Date;
  garmentType: string | null;
  compressionClass: string | null;
  patientName: string | null;
  patientId: string | null;
};

export type DashboardPendingWorkItem = {
  id: string;
  kind: (typeof PENDING_WORK_KIND)[keyof typeof PENDING_WORK_KIND];
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  createdAt: Date;
};

export type DashboardPendingWork = {
  paymentFollowUpsCount: number;
  productionFollowUpsCount: number;
  draftMeasurementsCount: number;
  items: DashboardPendingWorkItem[];
};

export type DashboardData = {
  totalPatients: number;
  patientsCreatedTodayCount: number;
  activeOperationsCount: number;
  openMeasurementDraftsCount: number;
  completedMeasurementsTodayCount: number;
  totalDeposits: string;
  totalPendingBalance: string;
  latestPatients: DashboardPatient[];
  latestOperations: DashboardOperation[];
  latestMeasurements: DashboardMeasurement[];
  pendingWork: DashboardPendingWork;
};

function getPendingBalance(operation: Pick<DashboardOperation, "totalAmount" | "depositPaid">): number {
  return Math.max(Number(operation.totalAmount || 0) - Number(operation.depositPaid || 0), 0);
}

export function buildPendingWork(
  operations: DashboardOperation[],
  draftMeasurements: DashboardMeasurement[],
  limit: number,
): DashboardPendingWork {
  const paymentOperations = operations.filter((operation) =>
    operation.status !== OPERATION_STATUS.CANCELADO && getPendingBalance(operation) > 0
  );
  const productionOperations = operations.filter((operation) =>
    operation.status === OPERATION_STATUS.CONFIRMADO || operation.status === OPERATION_STATUS.EN_PRODUCCION
  );

  const paymentItems: DashboardPendingWorkItem[] = paymentOperations.map((operation) => ({
    id: `payment-${operation.id}`,
    kind: PENDING_WORK_KIND.PAYMENT,
    title: `Cobrar saldo: ${operation.patientName ?? "Paciente sin nombre"}`,
    description: `Pendiente ${String(getPendingBalance(operation))}${operation.garmentType ? ` · ${operation.garmentType}` : ""}. Abrir ficha del paciente para registrar abono o pago.`,
    href: operation.patientId ? `/patients/${operation.patientId}` : "/patients",
    actionLabel: "Abrir paciente",
    createdAt: operation.createdAt,
  }));

  const productionItems: DashboardPendingWorkItem[] = productionOperations.map((operation) => ({
    id: `production-${operation.id}`,
    kind: PENDING_WORK_KIND.PRODUCTION,
    title: `${operation.status === OPERATION_STATUS.EN_PRODUCCION ? "Seguimiento de entrega" : "Enviar a producción"}: ${operation.patientName ?? "Paciente sin nombre"}`,
    description: `${operation.status}${operation.garmentType ? ` · ${operation.garmentType}` : ""}. Abrir ficha del paciente para actualizar la operación.`,
    href: operation.patientId ? `/patients/${operation.patientId}` : "/patients",
    actionLabel: "Abrir paciente",
    createdAt: operation.createdAt,
  }));

  const measurementItems: DashboardPendingWorkItem[] = draftMeasurements.map((measurement) => ({
    id: `measurement-${measurement.id}`,
    kind: PENDING_WORK_KIND.MEASUREMENT,
    title: `Continuar medición: ${measurement.patientName ?? "Paciente sin nombre"}`,
    description: `${measurement.garmentType ?? "Medición"}${measurement.compressionClass ? ` · ${measurement.compressionClass}` : ""}.`,
    href: measurement.patientId ? `/patients/${measurement.patientId}/measurements/${measurement.id}/edit` : "/patients",
    actionLabel: measurement.patientId ? "Continuar medición" : "Buscar paciente",
    createdAt: measurement.measuredAt,
  }));

  const items = [...paymentItems, ...productionItems, ...measurementItems]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return {
    paymentFollowUpsCount: paymentOperations.length,
    productionFollowUpsCount: productionOperations.length,
    draftMeasurementsCount: draftMeasurements.length,
    items,
  };
}

const defaultRepository: DashboardRepository = {
  async getTotalPatients() {
    const prisma = getPrisma();
    return prisma.patient.count();
  },

  async getPatientsCreatedToday() {
    const prisma = getPrisma();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return prisma.patient.count({
      where: { createdAt: { gte: todayStart } },
    });
  },

  async getActiveOperationsCount() {
    const prisma = getPrisma();
    return prisma.commercialOperation.count({
      where: {
        status: {
          in: [OPERATION_STATUS.PRESUPUESTO, OPERATION_STATUS.CONFIRMADO, OPERATION_STATUS.EN_PRODUCCION],
        },
      },
    });
  },

  async getOpenMeasurementDraftsCount() {
    const prisma = getPrisma();
    return prisma.measurementSession.count({
      where: { status: MEASUREMENT_STATUS.DRAFT },
    });
  },

  async getCompletedMeasurementsTodayCount() {
    const prisma = getPrisma();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return prisma.measurementSession.count({
      where: {
        status: MEASUREMENT_STATUS.COMPLETED,
        measuredAt: { gte: todayStart },
      },
    });
  },

  async getTotalDeposits() {
    const prisma = getPrisma();
    const result = await prisma.commercialOperation.aggregate({
      where: { status: { not: OPERATION_STATUS.CANCELADO } },
      _sum: { depositPaid: true },
    });
    return result._sum.depositPaid?.toString() ?? "0";
  },

  async getTotalPendingBalance() {
    const prisma = getPrisma();
    const [sumTotal, sumDeposit] = await Promise.all([
      prisma.commercialOperation.aggregate({
        where: { status: { not: OPERATION_STATUS.CANCELADO } },
        _sum: { totalAmount: true },
      }),
      prisma.commercialOperation.aggregate({
        where: { status: { not: OPERATION_STATUS.CANCELADO } },
        _sum: { depositPaid: true },
      }),
    ]);
    const total = Number(sumTotal._sum.totalAmount?.toString() ?? 0) - Number(sumDeposit._sum.depositPaid?.toString() ?? 0);
    return String(total);
  },

  async getLatestPatients(limit) {
    const prisma = getPrisma();
    return prisma.patient.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, fullName: true, documentType: true, documentNumber: true, createdAt: true },
    });
  },

  async getLatestOperations(limit) {
    const prisma = getPrisma();
    const ops = await prisma.commercialOperation.findMany({
      where: { status: { not: OPERATION_STATUS.CANCELADO } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        patient: { select: { id: true, fullName: true } },
      },
    });
    return ops.map((op) => ({
      id: op.id,
      status: op.status,
      garmentType: op.garmentType,
      totalAmount: op.totalAmount?.toString() ?? "0",
      depositPaid: op.depositPaid.toString(),
      patientName: op.patient?.fullName ?? null,
      patientId: op.patient?.id ?? null,
      createdAt: op.createdAt,
    }));
  },

  async getPendingWork(limit) {
    const prisma = getPrisma();
    const [operations, draftMeasurements] = await Promise.all([
      prisma.commercialOperation.findMany({
        where: { status: { not: OPERATION_STATUS.CANCELADO } },
        orderBy: { createdAt: "desc" },
        take: limit * 4,
        include: {
          patient: { select: { id: true, fullName: true } },
        },
      }),
      prisma.measurementSession.findMany({
        where: { status: MEASUREMENT_STATUS.DRAFT },
        orderBy: { measuredAt: "desc" },
        take: limit * 2,
        include: {
          patient: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return buildPendingWork(
      operations.map((operation) => ({
        id: operation.id,
        status: operation.status,
        garmentType: operation.garmentType,
        totalAmount: operation.totalAmount?.toString() ?? "0",
        depositPaid: operation.depositPaid.toString(),
        patientName: operation.patient?.fullName ?? null,
        patientId: operation.patient?.id ?? null,
        createdAt: operation.createdAt,
      })),
      draftMeasurements.map((measurement) => ({
        id: measurement.id,
        status: measurement.status,
        measuredAt: measurement.measuredAt,
        garmentType: measurement.garmentType,
        compressionClass: measurement.compressionClass,
        patientName: measurement.patient?.fullName ?? null,
        patientId: measurement.patient?.id ?? null,
      })),
      limit,
    );
  },

  async getLatestMeasurements(limit) {
    const prisma = getPrisma();
    const measurements = await prisma.measurementSession.findMany({
      where: { status: { not: MEASUREMENT_STATUS.VOID } },
      orderBy: { measuredAt: "desc" },
      take: limit,
      include: {
        patient: { select: { id: true, fullName: true } },
      },
    });

    return measurements.map((measurement) => ({
      id: measurement.id,
      status: measurement.status,
      measuredAt: measurement.measuredAt,
      garmentType: measurement.garmentType,
      compressionClass: measurement.compressionClass,
      patientName: measurement.patient?.fullName ?? null,
      patientId: measurement.patient?.id ?? null,
    }));
  },
};

export async function fetchDashboardData(
  repository: DashboardRepository = defaultRepository,
): Promise<DashboardData> {
  const [
    totalPatients,
    patientsCreatedTodayCount,
    activeOperationsCount,
    openMeasurementDraftsCount,
    completedMeasurementsTodayCount,
    totalDeposits,
    totalPendingBalance,
    latestPatients,
    latestOperations,
    latestMeasurements,
    pendingWork,
  ] = await Promise.all([
    repository.getTotalPatients(),
    repository.getPatientsCreatedToday(),
    repository.getActiveOperationsCount(),
    repository.getOpenMeasurementDraftsCount(),
    repository.getCompletedMeasurementsTodayCount(),
    repository.getTotalDeposits(),
    repository.getTotalPendingBalance(),
    repository.getLatestPatients(5),
    repository.getLatestOperations(5),
    repository.getLatestMeasurements(5),
    repository.getPendingWork(6),
  ]);

  return {
    totalPatients,
    patientsCreatedTodayCount,
    activeOperationsCount,
    openMeasurementDraftsCount,
    completedMeasurementsTodayCount,
    totalDeposits,
    totalPendingBalance,
    latestPatients,
    latestOperations,
    latestMeasurements,
    pendingWork,
  };
}
