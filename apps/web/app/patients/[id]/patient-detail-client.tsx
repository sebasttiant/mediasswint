"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PATIENT_TIMELINE_EVENT_TYPE } from "@/lib/patient-timeline";

import styles from "../page.module.css";
import {
  buildMeasurementDetailHref,
  buildNewMeasurementHref,
  executePatientSaveNavigation,
  patientToFormState,
  type PatientDetail,
  type PatientFormState,
  type PatientMeasurementSummary,
  type PatientTimelineItem,
} from "./patient-detail-helpers";

function getTimelineBadgeLabel(type: string): string {
  if (type === PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_CREATED) return "Medición creada";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.MEASUREMENT_COMPLETED) return "Medición finalizada";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.PATIENT_CREATED) return "Paciente creado";
  if (type === PATIENT_TIMELINE_EVENT_TYPE.PATIENT_UPDATED) return "Paciente actualizado";
  return "Evento clínico";
}

export default function PatientDetailClient({
  initialPatient,
  recentMeasurements,
  timeline,
}: {
  initialPatient: PatientDetail;
  recentMeasurements: PatientMeasurementSummary[];
  timeline: PatientTimelineItem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<PatientFormState>(() => patientToFormState(initialPatient));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(initialPatient.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setError("Ya existe un paciente con ese documento");
          return;
        }

        if (response.status === 400) {
          setError("Datos inválidos. Revisá el formulario");
          return;
        }

        if (response.status === 404) {
          setError("El paciente ya no existe");
          return;
        }

        setError("No se pudo actualizar el paciente");
        return;
      }

      executePatientSaveNavigation(router);
    } catch {
      setError("No se pudo actualizar el paciente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>MEDIASSWINT · Gestión Clínica</p>
          <h1>Editar paciente</h1>
          <p className={styles.subtitle}>{initialPatient.fullName}</p>
        </div>
        <Link className={styles.detailLink} href="/patients">
          Volver al listado
        </Link>
      </header>

      <section className={styles.card}>
        <h2>Datos demográficos</h2>
        {error ? <p className={styles.error}>{error}</p> : null}
        <form onSubmit={onSubmit} className={styles.formGrid}>
          <label>
            Nombre completo*
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Tipo de documento
            <input
              value={form.documentType}
              onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
            />
          </label>
          <label>
            Número de documento
            <input
              value={form.documentNumber}
              onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))}
            />
          </label>
          <label>
            Fecha de nacimiento
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className={styles.fullWidthField}>
            Notas
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <button type="submit" disabled={saving} className={styles.primaryButton}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Historia clínica</h2>
            <p className={styles.muted}>Timeline cronológico de eventos del paciente</p>
          </div>
        </div>

        {timeline.length > 0 ? (
          <ol className={styles.timelineList}>
            {timeline.map((event) => (
              <li key={event.id} className={styles.timelineItem}>
                <div className={styles.timelineMarker} aria-hidden="true" />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeader}>
                    <span className={styles.timelineBadge}>{getTimelineBadgeLabel(event.type)}</span>
                    <time dateTime={event.occurredAt} className={styles.muted}>
                      {new Date(event.occurredAt).toLocaleString("es-AR")}
                    </time>
                  </div>
                  <h3>{event.title}</h3>
                  {event.description ? <p className={styles.muted}>{event.description}</p> : null}
                  {event.measurementId ? (
                    <Link
                      className={styles.patientNameLink}
                      href={buildMeasurementDetailHref(initialPatient.id, event.measurementId)}
                    >
                      Ver detalle de medición
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.muted}>Todavía no hay eventos clínicos para mostrar.</p>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <h2>Medidas</h2>
            <p className={styles.muted}>Mediciones digitales recientes del paciente</p>
          </div>
          <Link className={styles.primaryButton} href={buildNewMeasurementHref(initialPatient.id)}>
            Nueva medición
          </Link>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Prenda</th>
                <th>Clase</th>
                <th>Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {recentMeasurements.length > 0 ? (
                recentMeasurements.map((measurement) => (
                  <tr key={measurement.id}>
                    <td data-label="Fecha">
                      <Link
                        className={styles.patientNameLink}
                        href={buildMeasurementDetailHref(initialPatient.id, measurement.id)}
                      >
                        {new Date(measurement.measuredAt).toLocaleString("es-AR")}
                      </Link>
                    </td>
                    <td data-label="Estado">{measurement.status}</td>
                    <td data-label="Prenda">{measurement.garmentType ?? "—"}</td>
                    <td data-label="Clase">{measurement.compressionClass ?? "—"}</td>
                    <td data-label="Diagnóstico">{measurement.diagnosis ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    Todavía no hay mediciones cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
