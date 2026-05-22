"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./page.module.css";
import { buildPatientDetailHref, DOCUMENT_TYPE_OPTIONS, PATIENT_SEX_OPTIONS } from "./[id]/patient-detail-helpers";

type Patient = {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  createdAt: string;
};

type FormState = {
  fullName: string;
  sex: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
};

const INITIAL_FORM_STATE: FormState = {
  fullName: "",
  sex: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  phone: "",
  email: "",
  notes: "",
};

export default function PatientsClient() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPatients(searchQuery?: string) {
    try {
      const params = new URLSearchParams({ limit: "50" });
      const normalizedQuery = (searchQuery ?? query).trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      const response = await fetch(`/api/patients?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setError("No se pudo cargar pacientes");
        setPatients([]);
        return;
      }

      const payload = (await response.json()) as Patient[];
      setPatients(payload);
    } catch {
      setError("No se pudo cargar pacientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

        setError("No se pudo crear el paciente");
        return;
      }

      setForm(INITIAL_FORM_STATE);
      await loadPatients();
    } catch {
      setError("No se pudo crear el paciente");
    } finally {
      setSaving(false);
    }
  }

  async function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    await loadPatients(query);
  }

  function formatDocument(patient: Patient) {
    return [patient.documentType, patient.documentNumber].filter(Boolean).join(" ") || "-";
  }

  return (
    <div className={styles.page}>
      <section className={styles.orientationGrid} aria-label="Orientación de pacientes">
        <div className={styles.orientationCard}>
          <span>Ruta actual</span>
          <strong>Dashboard → Pacientes</strong>
          <p>Creá, buscá o abrí una ficha para continuar con mediciones y operaciones.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Registros visibles</span>
          <strong>{patients.length}</strong>
        </div>
      </section>

      <section className={styles.card}>
        <h2>Nuevo paciente</h2>
        <form onSubmit={onSubmit} className={styles.formGrid}>
          <label>
            Nombre completo*
            <input
              required
              placeholder="Ej: Ana Pérez"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>
          <label>
            Sexo
            <select
              value={form.sex}
              onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {PATIENT_SEX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Tipo de documento
            <select
              value={form.documentType}
              onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label>
            Número de documento
            <input
              placeholder="Ej: 10203040"
              value={form.documentNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, documentNumber: event.target.value }))
              }
            />
          </label>
          <label>
            Fecha de nacimiento
            <input
              type="date"
              value={form.birthDate}
              className={styles.dateInput}
              onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
            />
            <span className={styles.fieldHint}>Formato: AAAA-MM-DD</span>
          </label>
          <label>
            Teléfono
            <input
              placeholder="Ej: +57 300 000 0000"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            Email
            <input
              placeholder="Ej: paciente@email.com"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className={styles.fullWidthField}>
            Notas
            <textarea
              placeholder="Observaciones clínicas o administrativas"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <button type="submit" disabled={saving} className={styles.primaryButton}>
            {saving ? "Guardando..." : "Crear paciente"}
          </button>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.tableHeader}>
          <h2>Listado</h2>
          <form onSubmit={onSearchSubmit} className={styles.searchForm}>
            <input
              placeholder="Buscar por nombre o documento"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className={styles.ghostButton}>
              Buscar
            </button>
          </form>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {loading ? (
          <p className={styles.muted}>Cargando pacientes...</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <td data-label="Nombre">
                      <a className={styles.patientNameLink} href={buildPatientDetailHref(patient.id)}>
                        {patient.fullName}
                      </a>
                    </td>
                    <td data-label="Documento">{formatDocument(patient)}</td>
                    <td data-label="Alta">{new Date(patient.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={styles.muted}>
                      Sin pacientes para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
