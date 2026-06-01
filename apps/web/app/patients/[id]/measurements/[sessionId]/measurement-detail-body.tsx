import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowLeft, Pencil } from "lucide-react";

import { BodyHighlight } from "@/app/_components/body-highlight/body-highlight";
import { resolveMeasurementBodyFigureSex } from "@/lib/body-figure-sex";
import type { MeasurementSessionDetail } from "@/lib/measurements";
import { formatClinicDateTime } from "@/lib/datetime";

import styles from "../../../page.module.css";
import { buildMeasurementTableRows, getFilledZoneIdsFromValues, type MeasurementUiGroup } from "../measurements-ui";
import type {
  MeasurementDetailViewMeasurement,
  MeasurementDetailViewPatient,
} from "./measurement-detail-view";
import { DuplicateMeasurementButton } from "./duplicate-measurement-button";
import { ReopenMeasurementButton } from "./reopen-measurement-button";

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Completada", className: "bg-emerald-100 text-emerald-700" },
  VOID: { label: "Anulada", className: "bg-slate-200 text-slate-600" },
};

function StatusPill({ status }: { status: string }): ReactElement {
  const meta = STATUS_META[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function ClinicalField({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function formatDateTime(date: Date): string {
  // Explicit clinic timezone — see lib/datetime. Avoids runtime-tz drift.
  return formatClinicDateTime(date);
}

function buildMeasurementEditHref(patientId: string, sessionId: string): string {
  return `/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(sessionId)}/edit`;
}

function ReadOnlyMeasurementTable({
  group,
  snapshot,
  values,
}: {
  group: MeasurementUiGroup;
  snapshot: NonNullable<MeasurementSessionDetail["templateSnapshot"]>;
  values: Record<string, number | null>;
}): ReactElement {
  const rows = buildMeasurementTableRows(snapshot, group, values);
  const title = group === "legs" ? "Piernas" : "Brazos";

  return (
    <section className={styles.measurementPanel}>
      <h3>{title}</h3>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Punto</th>
              <th>Derecha</th>
              <th>Izquierda</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${group}-${row.point}`}>
                <td data-label="Punto">{row.point}</td>
                <td data-label="Derecha">{row.right?.value ?? "—"}</td>
                <td data-label="Izquierda">{row.left?.value ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MeasurementDetailBody({
  patient,
  measurement,
  isAdmin = false,
}: {
  patient: MeasurementDetailViewPatient;
  measurement: MeasurementDetailViewMeasurement;
  isAdmin?: boolean;
}): ReactElement {
  const snapshot = measurement.templateSnapshot as MeasurementSessionDetail["templateSnapshot"];
  const filledZoneIds = snapshot
    ? getFilledZoneIdsFromValues(snapshot, measurement.values)
    : undefined;

  const isDraft = measurement.status === "DRAFT";
  const isCompleted = measurement.status === "COMPLETED";
  const isVoid = measurement.status === "VOID";

  return (
    <div className={styles.page}>
      {/* Header card: clinical data in a clean grid, actions in a separate row
          below so no button can ever overlap a field (e.g. Diagnóstico). */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/patients/${encodeURIComponent(patient.id)}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Volver al paciente
            </Link>
          </div>
          <StatusPill status={measurement.status} />
        </div>

        <div className="px-5 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <ClinicalField label="Fecha" value={formatDateTime(measurement.measuredAt)} />
            <ClinicalField label="Prenda" value={measurement.garmentType ?? "—"} />
            <ClinicalField label="Clase" value={measurement.compressionClass ?? "—"} />
            <ClinicalField label="Diagnóstico" value={measurement.diagnosis ?? "—"} />
            <ClinicalField label="Notas" value={measurement.notes ?? "—"} />
          </dl>
        </div>

        {/* Actions row — separated from the data grid, wraps on small screens. */}
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6">
          {isDraft ? (
            <Link
              href={buildMeasurementEditHref(patient.id, measurement.id)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              <Pencil size={15} aria-hidden="true" />
              Continuar edición
            </Link>
          ) : null}

          {isCompleted ? (
            <>
              {isAdmin ? (
                <ReopenMeasurementButton patientId={patient.id} sessionId={measurement.id} />
              ) : null}
              <DuplicateMeasurementButton patientId={patient.id} sessionId={measurement.id} />
            </>
          ) : null}

          {isVoid ? (
            <p className="text-sm text-slate-500">Medición anulada — no editable.</p>
          ) : null}
        </div>
      </section>

      {snapshot ? (
        <section className={styles.card}>
          <div className={styles.measurementWorkspace}>
            <aside className={styles.bodyHighlightRail} aria-label="Zonas anatómicas">
              <BodyHighlight
                view="full"
                sex={resolveMeasurementBodyFigureSex(measurement.metadata, patient.sex)}
                activeZoneId={null}
                filledZoneIds={filledZoneIds}
                ariaLabel="Resumen anatómico con zonas medidas"
              />
            </aside>
            <div className={styles.measurementTables}>
              <ReadOnlyMeasurementTable group="legs" snapshot={snapshot} values={measurement.values} />
              <ReadOnlyMeasurementTable group="arms" snapshot={snapshot} values={measurement.values} />
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.card}>
          <p className={styles.error}>La medición no tiene snapshot de plantilla.</p>
        </section>
      )}
    </div>
  );
}
