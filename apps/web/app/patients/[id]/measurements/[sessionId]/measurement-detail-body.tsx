import Link from "next/link";
import type { ReactElement } from "react";
import { ArrowLeft, Pencil } from "lucide-react";

import { BodyHighlight } from "@/app/_components/body-highlight/body-highlight";
import { resolveMeasurementBodyFigureSex } from "@/lib/body-figure-sex";
import { resolveGarmentDisplay } from "@/lib/garment-catalog";
import type { MeasurementSessionDetail } from "@/lib/measurements";
import { parseTemplateSnapshot } from "@/lib/template-snapshot";
import { formatClinicDateTime } from "@/lib/datetime";
import { classifyMpBermudaSnapshot, type MpBermudaLayoutState } from "@/lib/mp-bermuda-layout";

import styles from "../../../page.module.css";
import { buildMeasurementTableRows, buildMpBermudaFieldStripItems, getFilledZoneIdsFromValues, type MeasurementUiGroup } from "../measurements-ui";
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

// W7 — Historical/degraded rendering for MP/Bermuda sessions. The detail page
// must never be blank for an MP session: when classification succeeds it shows
// the structured 55-field summary; when it does not, it falls back to a raw
// key/label/value table plus a visible warning. Raw values are preserved
// exactly, never coerced to canonical, never silently hidden.

// The classifier's `reason` is an English diagnostic meant for logs and tests.
// What a clinician reads is decided here, in the language of the rest of the UI,
// and it says what they can still trust rather than naming the broken invariant.
const MP_DEGRADATION_NOTICE: Partial<Record<MpBermudaLayoutState, string>> = {
  "visual-degraded":
    "Esta sesión no conserva las marcas visuales de su plantilla. Las medidas se muestran en formato de texto.",
  "clinical-incomplete":
    "La plantilla de esta sesión no coincide con el contrato clínico vigente. Se muestran las medidas tal como quedaron registradas.",
};

function MpBermudaDetailSummary({
  snapshot,
  classification,
  values,
}: {
  snapshot: NonNullable<MeasurementSessionDetail["templateSnapshot"]>;
  classification: MpBermudaLayoutState;
  values: Record<string, number | null>;
}): ReactElement {
  const notice = MP_DEGRADATION_NOTICE[classification] ?? null;
  const items = buildMpBermudaFieldStripItems(snapshot);

  return (
    <section className={styles.card}>
      <div className={styles.measurementWorkspace}>
        <div className={styles.measurementTables}>
          <h3>Medidas MP/Bermuda</h3>
          {notice ? (
            <p role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {notice}
            </p>
          ) : null}
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Medida</th>
                  <th>Lado</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const value = values[item.key];
                  const sideText =
                    item.side === "right" ? "Derecho" : item.side === "left" ? "Izquierdo" : "Compartido";
                  return (
                    <tr key={`${item.key}-${index}`}>
                      <td data-label="Medida">{item.label}</td>
                      <td data-label="Lado">{sideText}</td>
                      <td data-label="Valor">
                        {value === null || value === undefined ? "—" : String(value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// Last-resort fallback: a frozen MP session whose snapshot cannot even be
// classified (or carries no parseable fields) still has stored values worth
// showing. Render them as a raw key/label/value table plus a visible warning.
// Raw values are preserved exactly, never coerced to canonical, never hidden.
function RawValuesTable({
  values,
}: {
  values: Record<string, number | null>;
}): ReactElement {
  const entries = Object.entries(values);
  return (
    <section className={styles.card}>
      <p className={styles.error}>
        No pudimos leer la plantilla de medidas de esta sesión. Se muestran los
        valores crudos almacenados; avisá al equipo para regenerar la plantilla.
      </p>
      <div className={styles.measurementTables}>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Clave</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={2} data-label="Sin valores">Sin valores almacenados</td>
                </tr>
              ) : (
                entries.map(([key, value]) => (
                  <tr key={key}>
                    <td data-label="Clave">{key}</td>
                    <td data-label="Valor">{value === null ? "—" : String(value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
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
  // The view model carries the snapshot as `unknown` because it comes straight
  // from a Json column. Validate it here rather than casting: an unreadable
  // snapshot must render a session without its figure, never crash the page.
  const snapshot = parseTemplateSnapshot(measurement.templateSnapshot);

  // W7 — MP/Bermuda sessions own their own detail rendering. They cannot fall
  // through to `ReadOnlyMeasurementTable` because `buildMeasurementTableRows`
  // projects compression's {group, side, point} groups and MP fields carry no
  // such metadata. The structured summary shows every field the frozen snapshot
  // still carries; the raw key/value table is the last resort when it carries
  // none. `not-mp` is the ownership answer for every foreign template, and it
  // must reach neither branch — compression, Mentonera and Máscara keep their
  // existing BodyHighlight + legs/arms rendering untouched.
  const mpLayout = classifyMpBermudaSnapshot(snapshot).kind;
  const isMpBermuda = mpLayout !== "not-mp" && mpLayout !== "structurally-malformed";
  const showMpRawFallback = mpLayout === "structurally-malformed";

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
            <ClinicalField
              label="Prenda"
              value={
                resolveGarmentDisplay(measurement.garmentType, measurement.metadata) || "—"
              }
            />
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

      {snapshot && isMpBermuda ? (
        <MpBermudaDetailSummary snapshot={snapshot} classification={mpLayout} values={measurement.values} />
      ) : showMpRawFallback ? (
        <RawValuesTable values={measurement.values} />
      ) : snapshot ? (
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
