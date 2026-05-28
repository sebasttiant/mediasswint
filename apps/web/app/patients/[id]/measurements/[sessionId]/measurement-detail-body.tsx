import Link from "next/link";
import type { ReactElement } from "react";

import { BODY_FIGURE_SEX, BodyHighlight, type BodyFigureSex } from "@/app/_components/body-highlight/body-highlight";
import type { MeasurementSessionDetail } from "@/lib/measurements";

import styles from "../../../page.module.css";
import { buildMeasurementTableRows, getFilledZoneIdsFromValues, type MeasurementUiGroup } from "../measurements-ui";
import type {
  MeasurementDetailViewMeasurement,
  MeasurementDetailViewPatient,
} from "./measurement-detail-view";

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveBodyFigureSex(patientSex: string | null): BodyFigureSex {
  return patientSex === "MALE" ? BODY_FIGURE_SEX.MALE : BODY_FIGURE_SEX.FEMALE;
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
}: {
  patient: MeasurementDetailViewPatient;
  measurement: MeasurementDetailViewMeasurement;
}): ReactElement {
  const snapshot = measurement.templateSnapshot as MeasurementSessionDetail["templateSnapshot"];
  const filledZoneIds = snapshot
    ? getFilledZoneIdsFromValues(snapshot, measurement.values)
    : undefined;

  return (
    <>
      <section className={styles.card}>
        <p className={styles.muted}>
          <Link className={styles.patientNameLink} href={`/patients/${encodeURIComponent(patient.id)}`}>
            Volver al paciente
          </Link>
        </p>
        <div className={styles.measurementSummaryGrid}>
          <p><strong>Estado:</strong> {measurement.status}</p>
          <p><strong>Fecha:</strong> {formatDateTime(measurement.measuredAt)}</p>
          <p><strong>Prenda:</strong> {measurement.garmentType ?? "—"}</p>
          <p><strong>Clase:</strong> {measurement.compressionClass ?? "—"}</p>
          <p><strong>Diagnóstico:</strong> {measurement.diagnosis ?? "—"}</p>
          <p><strong>Notas:</strong> {measurement.notes ?? "—"}</p>
        </div>
      </section>

      {snapshot ? (
        <section className={styles.card}>
          <div className={styles.measurementWorkspace}>
            <aside className={styles.bodyHighlightRail} aria-label="Zonas anatómicas">
              <BodyHighlight
                view="full"
                sex={resolveBodyFigureSex(patient.sex)}
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
    </>
  );
}
