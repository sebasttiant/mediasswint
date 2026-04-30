import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BodyHighlight } from "@/app/_components/body-highlight/body-highlight";
import { getSessionCookieName, requireActiveUserFromRequest } from "@/lib/auth";
import { getDefaultMeasurementsRepository, getMeasurement, type TemplateSnapshot } from "@/lib/measurements";
import { getPatient } from "@/lib/patients";

import styles from "../../../page.module.css";
import { resolvePatientDetailLoad } from "../../patient-detail-loading";
import { buildMeasurementTableRows, type MeasurementUiGroup } from "../measurements-ui";

type Params = {
  params: Promise<{ id: string; sessionId: string }>;
};

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ReadOnlyMeasurementTable({
  group,
  snapshot,
  values,
}: {
  group: MeasurementUiGroup;
  snapshot: TemplateSnapshot;
  values: Record<string, number | null>;
}) {
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

export default async function MeasurementDetailPage({ params }: Params) {
  const { id, sessionId } = await params;
  const sessionCookie = (await cookies()).get(getSessionCookieName())?.value;
  const request = new Request(
    `http://localhost/patients/${encodeURIComponent(id)}/measurements/${encodeURIComponent(sessionId)}`,
    {
      headers: sessionCookie ? { cookie: `${getSessionCookieName()}=${encodeURIComponent(sessionCookie)}` } : undefined,
    },
  );
  const user = await requireActiveUserFromRequest(request);
  const patientResult = user ? await getPatient(id) : { ok: false as const, error: "UNKNOWN" as const };
  const decision = resolvePatientDetailLoad(user, patientResult);

  if (decision.action === "redirect") redirect(decision.location);
  if (decision.action === "notFound") notFound();
  if (decision.action === "throw") throw new Error("Unable to load patient detail");

  const measurementResult = await getMeasurement(sessionId, getDefaultMeasurementsRepository());
  if (!measurementResult.ok || measurementResult.value.patientId !== id) notFound();

  const measurement = measurementResult.value;
  const snapshot = measurement.templateSnapshot;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>MEDIASSWINT · Medición Digital</p>
          <h1>Detalle de medición</h1>
          <p className={styles.subtitle}>{decision.patient.fullName}</p>
        </div>
        <Link className={styles.detailLink} href={`/patients/${encodeURIComponent(id)}`}>
          Volver al paciente
        </Link>
      </header>

      <section className={styles.card}>
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
              <BodyHighlight view="legs" activeZoneId={null} />
              <BodyHighlight view="arms" activeZoneId={null} />
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
    </main>
  );
}
