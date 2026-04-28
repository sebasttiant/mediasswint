import type { Patient } from "@prisma/client";

type DetailUser = {
  id: string;
  role: string;
};

type PatientResult = { ok: true; value: Patient } | { ok: false; error: "CONFLICT" | "NOT_FOUND" | "UNKNOWN" };

export type PatientDetailLoadDecision =
  | { action: "redirect"; location: "/login" }
  | { action: "notFound" }
  | { action: "throw" }
  | { action: "render"; patient: Patient };

export function resolvePatientDetailLoad(
  user: DetailUser | null,
  patientResult: PatientResult,
): PatientDetailLoadDecision {
  if (!user) {
    return { action: "redirect", location: "/login" };
  }

  if (patientResult.ok) {
    return { action: "render", patient: patientResult.value };
  }

  if (patientResult.error === "NOT_FOUND") {
    return { action: "notFound" };
  }

  return { action: "throw" };
}
