import type { Patient } from "@prisma/client";

import type { CreatePatientInput, ListPatientsQuery } from "@/lib/patients-input";
import { getPrisma } from "@/lib/prisma";

type ServiceErrorCode = "CONFLICT" | "NOT_FOUND" | "UNKNOWN";

type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceErrorCode };

export type PatientsRepository = {
  create(input: CreatePatientInput): Promise<Patient>;
  list(query: ListPatientsQuery): Promise<Patient[]>;
  getById(id: string): Promise<Patient | null>;
};

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === "P2002";
}

const defaultRepository: PatientsRepository = {
  async create(input) {
    const prisma = getPrisma();

    return prisma.patient.create({
      data: {
        fullName: input.fullName,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        birthDate: input.birthDate,
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
};

export async function createPatient(
  input: CreatePatientInput,
  repository: PatientsRepository = defaultRepository,
): Promise<ServiceResult<Patient>> {
  try {
    const patient = await repository.create(input);
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
