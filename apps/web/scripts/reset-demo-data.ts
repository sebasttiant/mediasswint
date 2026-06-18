import { Prisma } from "@prisma/client";

import { COMPRESSION_TEMPLATE_CODE } from "@/lib/compression-template";
import { getPrisma } from "@/lib/prisma";

export const DEMO_MARKER = "[DEMO_DATA]";

const DEMO_DOCUMENT_NUMBERS = [
  "1001001001",
  "1001001002",
  "1001001003",
  "1001001004",
  "1001001005",
  "1001001006",
  "1001001007",
  "1001001008",
  "1001001009",
  "1001001010",
] as const;

export interface ResetDemoDataOptions {
  fullReset: boolean;
  deleteUsers: boolean;
}

export interface ResetDemoDataResult {
  auditLogs: number;
  dailyCashCounts: number;
  expenses: number;
  paymentMovements: number;
  commercialOperations: number;
  measurementValues: number;
  measurementSessions: number;
  patients: number;
  templates: number;
  users: number;
}

function isTruthyFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function getOptionsFromEnv(): ResetDemoDataOptions {
  return {
    fullReset: isTruthyFlag(process.env["DEMO_FULL_RESET"]),
    deleteUsers: isTruthyFlag(process.env["DEMO_DELETE_USERS"]),
  };
}

export async function resetDemoData(options: ResetDemoDataOptions): Promise<ResetDemoDataResult> {
  const prisma = getPrisma();
  const patientWhere: Prisma.PatientWhereInput = options.fullReset
    ? {}
    : {
        OR: [
          { documentNumber: { in: [...DEMO_DOCUMENT_NUMBERS] } },
          { notes: { contains: DEMO_MARKER } },
        ],
      };
  const operationWhere: Prisma.CommercialOperationWhereInput = options.fullReset
    ? {}
    : {
        OR: [
          { notes: { contains: DEMO_MARKER } },
          { orderNumber: { startsWith: "DEMO-" } },
          { patient: patientWhere },
        ],
      };
  const sessionWhere: Prisma.MeasurementSessionWhereInput = options.fullReset
    ? {}
    : {
        OR: [{ notes: { contains: DEMO_MARKER } }, { patient: patientWhere }],
      };

  return prisma.$transaction(async (tx) => {
    const auditLogs = await tx.auditLog.deleteMany({
      where: options.fullReset
        ? {}
        : {
            OR: [
              { entityType: { startsWith: "Demo" } },
              { diff: { path: ["marker"], equals: DEMO_MARKER } },
            ],
          },
    });
    const paymentMovements = await tx.paymentMovement.deleteMany({
      where: options.fullReset
        ? {}
        : {
            OR: [
              { note: { contains: DEMO_MARKER } },
              { operation: operationWhere },
              { patient: patientWhere },
            ],
          },
    });
    const expenses = await tx.expense.deleteMany({
      where: options.fullReset
        ? {}
        : {
            OR: [
              { note: { contains: DEMO_MARKER } },
              { concept: { startsWith: "Demo -" } },
            ],
          },
    });
    const dailyCashCounts = await tx.dailyCashCount.deleteMany({
      where: options.fullReset ? {} : { note: { contains: DEMO_MARKER } },
    });
    const commercialOperations = await tx.commercialOperation.deleteMany({ where: operationWhere });
    const measurementValues = await tx.measurementValue.deleteMany({ where: { session: sessionWhere } });
    const measurementSessions = await tx.measurementSession.deleteMany({ where: sessionWhere });
    const patients = await tx.patient.deleteMany({ where: patientWhere });
    const templates = options.fullReset
      ? await tx.measurementTemplate.deleteMany({ where: { code: COMPRESSION_TEMPLATE_CODE } })
      : { count: 0 };
    const users = options.fullReset && options.deleteUsers
      ? await tx.user.deleteMany({})
      : { count: 0 };

    return {
      auditLogs: auditLogs.count,
      dailyCashCounts: dailyCashCounts.count,
      expenses: expenses.count,
      paymentMovements: paymentMovements.count,
      commercialOperations: commercialOperations.count,
      measurementValues: measurementValues.count,
      measurementSessions: measurementSessions.count,
      patients: patients.count,
      templates: templates.count,
      users: users.count,
    };
  });
}

function printResult(result: ResetDemoDataResult, options: ResetDemoDataOptions): void {
  console.log("[demo:reset] completed", {
    mode: options.fullReset ? "full" : "demo-only",
    deleteUsers: options.deleteUsers,
    ...result,
  });
}

async function main(): Promise<void> {
  const options = getOptionsFromEnv();
  const result = await resetDemoData(options);
  printResult(result, options);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error: unknown) => {
      console.error("[demo:reset] failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await getPrisma().$disconnect();
    });
}
