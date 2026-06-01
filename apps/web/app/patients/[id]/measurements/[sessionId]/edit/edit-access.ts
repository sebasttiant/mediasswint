import type { MeasurementSessionDetail, TemplateSnapshot } from "@/lib/measurements";

/**
 * Pure access guard for the measurement edit route. Editing is only allowed for
 * DRAFT sessions that still own a template snapshot and belong to the patient in
 * the URL. COMPLETED/VOID sessions are read-only and must never resume here, so
 * the body of the rule lives in one testable place instead of inline in the page.
 */
export type DraftEditAccess =
  | { action: "notFound" }
  | { action: "render"; detail: MeasurementSessionDetail; templateSnapshot: TemplateSnapshot };

export function resolveDraftEditAccess(
  patientId: string,
  measurement: { ok: true; value: MeasurementSessionDetail } | { ok: false },
): DraftEditAccess {
  if (!measurement.ok) return { action: "notFound" };

  const detail = measurement.value;
  if (detail.patientId !== patientId) return { action: "notFound" };
  if (detail.status !== "DRAFT") return { action: "notFound" };
  if (!detail.templateSnapshot) return { action: "notFound" };

  return { action: "render", detail, templateSnapshot: detail.templateSnapshot };
}
