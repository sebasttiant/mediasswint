"use client";

import { FormEvent, useEffect, useState } from "react";

type Patient = {
  id: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  createdAt: string;
};

type FormState = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
};

const INITIAL_FORM_STATE: FormState = {
  fullName: "",
  documentType: "",
  documentNumber: "",
  birthDate: "",
  phone: "",
  email: "",
  notes: "",
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPatients() {
    try {
      const response = await fetch("/api/patients?limit=50", { cache: "no-store" });
      if (!response.ok) {
        setError("No se pudo cargar pacientes");
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
    let active = true;

    fetch("/api/patients?limit=50", { cache: "no-store" })
      .then(async (response) => {
        if (!active) return;

        if (!response.ok) {
          setError("No se pudo cargar pacientes");
          return;
        }

        const payload = (await response.json()) as Patient[];
        setPatients(payload);
      })
      .catch(() => {
        if (active) {
          setError("No se pudo cargar pacientes");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
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

  return (
    <main style={{ display: "grid", gap: "1.5rem", padding: "2rem", maxWidth: "960px" }}>
      <h1>Pacientes</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <input
          required
          placeholder="Nombre completo"
          value={form.fullName}
          onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
        />
        <input
          placeholder="Tipo de documento"
          value={form.documentType}
          onChange={(event) =>
            setForm((current) => ({ ...current, documentType: event.target.value }))
          }
        />
        <input
          placeholder="Número de documento"
          value={form.documentNumber}
          onChange={(event) =>
            setForm((current) => ({ ...current, documentNumber: event.target.value }))
          }
        />
        <input
          type="date"
          value={form.birthDate}
          onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
        />
        <input
          placeholder="Teléfono"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        <textarea
          placeholder="Notas"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />

        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Crear paciente"}
        </button>
      </form>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      <section>
        <h2>Listado</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Nombre</th>
                <th style={{ textAlign: "left" }}>Documento</th>
                <th style={{ textAlign: "left" }}>Alta</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.fullName}</td>
                  <td>{[patient.documentType, patient.documentNumber].filter(Boolean).join(" ") || "-"}</td>
                  <td>{new Date(patient.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin pacientes aún.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
