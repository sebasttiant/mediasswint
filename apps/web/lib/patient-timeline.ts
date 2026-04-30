import type { Patient } from "@prisma/client";

import type { MeasurementSessionSummary } from "./measurements";

export const PATIENT_TIMELINE_EVENT_TYPE = {
  PATIENT_CREATED: "PATIENT_CREATED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  MEASUREMENT_CREATED: "MEASUREMENT_CREATED",
  MEASUREMENT_COMPLETED: "MEASUREMENT_COMPLETED",
  ORDER_CREATED: "ORDER_CREATED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  DELIVERY_COMPLETED: "DELIVERY_COMPLETED",
  ATTACHMENT_ADDED: "ATTACHMENT_ADDED",
  AUDIT_LOG: "AUDIT_LOG",
} as const;

export type PatientTimelineEventType =
  (typeof PATIENT_TIMELINE_EVENT_TYPE)[keyof typeof PATIENT_TIMELINE_EVENT_TYPE];

export const PATIENT_TIMELINE_SOURCE = {
  PATIENT: "PATIENT",
  MEASUREMENT: "MEASUREMENT",
  ORDER: "ORDER",
  PAYMENT: "PAYMENT",
  DELIVERY: "DELIVERY",
  ATTACHMENT: "ATTACHMENT",
  AUDIT: "AUDIT",
} as const;

export type PatientTimelineSource = (typeof PATIENT_TIMELINE_SOURCE)[keyof typeof PATIENT_TIMELINE_SOURCE];

export type PatientTimelinePatient = Pick<Patient, "id" | "createdAt" | "updatedAt">;

export type PatientTimelineMeasurement = Pick<
  MeasurementSessionSummary,
  "id" | "patientId" | "status" | "measuredAt" | "garmentType" | "compressionClass" | "diagnosis" | "createdAt" | "updatedAt"
>;

export type PatientTimelineEvent = {
  id: string;
  type: PatientTimelineEventType;
  source: PatientTimelineSource;
  occurredAt: Date;
  title: string;
  description: string | null;
  patientId: string;
  measurementId: string | null;
};

export type PatientTimelineRepository = {
  getPatient(patientId: string): Promise<PatientTimelinePatient | null>;
  listMeasurements(patientId: string, limit: number): Promise<PatientTimelineMeasurement[]>;
};

export type ListPatientTimelineOptions = {
  limit: number;
};

type PatientTimelineErrorCode = "NOT_FOUND" | "UNKNOWN";

export type PatientTimelineResult<T> = { ok: true; value: T } | { ok: false; error: PatientTimelineErrorCode };

function dateChanged(first: Date, second: Date): boolean {
  return first.getTime() !== second.getTime();
}

function describeMeasurement(measurement: PatientTimelineMeasurement): string | null {
  const parts = [measurement.garmentType, measurement.compressionClass, measurement.diagnosis].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildPatientTimeline(
  patient: PatientTimelinePatient,
  measurements: ReadonlyArray<PatientTimelineMeasurement>,
): PatientTimelineEvent[] {
  const events: PatientTimelineEvent[] = [
    {
      id: `patient:${patient.id}:created`,
      type: PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED,
      source: PATIENT_TIMELINE_SOURCE.PATIENT,
      occurredAt: patient.createdAt,
      title: "Paciente creado",
      description: null,
      patientId: patient.id,
      measurementId: null,
    },
  ];

  if (dateChanged(patient.createdAt, patient.updatedAt)) {
    events.push({
      id: `patient:${patient.id}:updated`,
      type: PATIENT_TIMELINE_EVENT_TYPE.PATIENT_UPDATED,
      source: PATIENT_TIMELINE_SOURCE.PATIENT,
      occurredAt: patient.updatedAt,
      title: "Paciente actualizado",
      description: null,
      patientId: patient.id,
      measurementId: null,
    });
  }

  for (const measurement of measurements) {
    events.push({
      id: `measurement:${measurement.id}:created`,
      type: PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_CREATED,
      source: PATIENT_TIMELINE_SOURCE.MEASUREMENT,
      occurredAt: measurement.createdAt,
      title: "Medición creada",
      description: describeMeasurement(measurement),
      patientId: measurement.patientId,
      measurementId: measurement.id,
    });

    if (measurement.status === "COMPLETED") {
      events.push({
        id: `measurement:${measurement.id}:completed`,
        type: PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_COMPLETED,
        source: PATIENT_TIMELINE_SOURCE.MEASUREMENT,
        occurredAt: measurement.updatedAt,
        title: "Medición finalizada",
        description: describeMeasurement(measurement),
        patientId: measurement.patientId,
        measurementId: measurement.id,
      });
    }
  }

  return events.toSorted((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

export async function listPatientTimeline(
  patientId: string,
  options: ListPatientTimelineOptions,
  repository: PatientTimelineRepository,
): Promise<PatientTimelineResult<PatientTimelineEvent[]>> {
  try {
    const patient = await repository.getPatient(patientId);
    if (!patient) return { ok: false, error: "NOT_FOUND" };

    const measurements = await repository.listMeasurements(patientId, options.limit);
    return { ok: true, value: buildPatientTimeline(patient, measurements) };
  } catch (error) {
    console.error("[patientTimeline:list]", error);
    return { ok: false, error: "UNKNOWN" };
  }
}
