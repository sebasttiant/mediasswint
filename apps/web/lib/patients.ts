import type { Patient } from "@prisma/client";

import { recordAudit, toAuditPayload } from "@/lib/audit-log";
import type { CreatePatientInput, ListPatientsQuery, UpdatePatientInput } from "@/lib/patients-input";
import { getPrisma } from "@/lib/prisma";

type ServiceErrorCode = "CONFLICT" | "NOT_FOUND" | "UNKNOWN";

type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceErrorCode };

export type PatientsRepository = {
  create(input: CreatePatientInput): Promise<Patient>;
  list(query: ListPatientsQuery): Promise<Patient[]>;
  getById(id: string): Promise<Patient | null>;
  update(id: string, input: UpdatePatientInput): Promise<Patient | null>;
};

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === "P2002";
}

function isRecordWithCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

function isMissingRecord(error: unknown): boolean {
  return isRecordWithCode(error, "P2025");
}

const defaultRepository: PatientsRepository = {
  async create(input) {
    const prisma = getPrisma();

    return prisma.patient.create({
      data: {
        fullName: input.fullName,
        sex: input.sex,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate: input.birthDate,
        address: input.address,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
    });
  },

  async list(query) {
    const prisma = getPrisma();

    return prisma.patient.findMany({
      where: query.q
        ? {
            OR: [
              {
                fullName: {
                  contains: query.q,
                  mode: "insensitive",
                },
              },
              {
                documentNumber: {
                  contains: query.q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit,
    });
  },

  async getById(id) {
    const prisma = getPrisma();

    return prisma.patient.findUnique({ where: { id } });
  },

  async update(id, input) {
    const prisma = getPrisma();

    return prisma.patient.update({
      where: { id },
      data: {
        fullName: input.fullName,
        sex: input.sex,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate: input.birthDate,
        address: input.address,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
      },
    });
  },
};

export async function createPatient(
  input: CreatePatientInput,
  repository: PatientsRepository = defaultRepository,
): Promise<ServiceResult<Patient>> {
  try {
    const patient = await repository.create(input);
    await recordAudit({
      action: "CREATE",
      entityType: "Patient",
      entityId: patient.id,
      diff: { after: toAuditPayload(patient) },
    });
    return { ok: true, value: patient };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "CONFLICT" };
    }

    return { ok: false, error: "UNKNOWN" };
  }
}

export async function listPatients(
  query: ListPatientsQuery,
  repository: PatientsRepository = defaultRepository,
): Promise<ServiceResult<Patient[]>> {
  try {
    const patients = await repository.list(query);
    return { ok: true, value: patients };
  } catch (error) {
    console.error("[patients:list]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function getPatient(
  id: string,
  repository: PatientsRepository = defaultRepository,
): Promise<ServiceResult<Patient>> {
  try {
    const patient = await repository.getById(id);
    if (!patient) {
      return { ok: false, error: "NOT_FOUND" };
    }

    return { ok: true, value: patient };
  } catch (error) {
    console.error("[patients:get]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
  repository: PatientsRepository = defaultRepository,
): Promise<ServiceResult<Patient>> {
  try {
    const before = await repository.getById(id);
    const patient = await repository.update(id, input);
    if (!patient) {
      return { ok: false, error: "NOT_FOUND" };
    }

    await recordAudit({
      action: "UPDATE",
      entityType: "Patient",
      entityId: patient.id,
      diff: { before: toAuditPayload(before), after: toAuditPayload(patient) },
    });

    return { ok: true, value: patient };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "CONFLICT" };
    }

    if (isMissingRecord(error)) {
      return { ok: false, error: "NOT_FOUND" };
    }

    console.error("[patients:update]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}
