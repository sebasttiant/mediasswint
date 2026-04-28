"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../page.module.css";
import {
  executePatientSaveNavigation,
  patientToFormState,
  type PatientDetail,
  type PatientFormState,
} from "./patient-detail-helpers";

export default function PatientDetailClient({ initialPatient }: { initialPatient: PatientDetail }) {
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
        <a className={styles.detailLink} href="/patients">
          Volver al listado
        </a>
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
    </main>
  );
}
