"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { Calendar, Hash, Mail, Phone, Search, User, UserPlus, Users } from "lucide-react";

import { Button } from "../_components/ui/button";
import { Card, CardBody, CardHeader } from "../_components/ui/card";
import { cn } from "../_components/ui/cn";
import { DataTable, type DataTableColumn } from "../_components/dashboard/data-table";
import { buildPatientDetailHref, DOCUMENT_TYPE_OPTIONS, PATIENT_SEX_OPTIONS } from "./[id]/patient-detail-helpers";
import { formatClinicDate } from "@/lib/datetime";

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

const FIELD_LABEL = "text-sm font-medium text-slate-700";
const FIELD_CONTROL =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10";

type FieldProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
};

// Shared label + optional leading-icon scaffold so every control in the rail
// keeps the same rhythm without repeating wrapper markup per field.
function Field({ label, icon, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <div className="relative">
        {icon ? (
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        {children}
      </div>
    </label>
  );
}

type PatientsClientProps = {
  initialQuery?: string;
};

export default function PatientsClient({ initialQuery = "" }: PatientsClientProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [query, setQuery] = useState(initialQuery);
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
    void loadPatients(initialQuery);
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
    return [patient.documentType, patient.documentNumber].filter(Boolean).join(" ") || "—";
  }

  const columns: DataTableColumn<Patient>[] = [
    {
      key: "name",
      header: "Nombre",
      render: (patient) => (
        <a
          className="inline-flex items-center gap-2.5 font-semibold text-slate-800 transition-colors hover:text-brand"
          href={buildPatientDetailHref(patient.id)}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
            {patient.fullName.charAt(0).toUpperCase()}
          </span>
          {patient.fullName}
        </a>
      ),
    },
    {
      key: "document",
      header: "Documento",
      render: (patient) => <span className="text-slate-500">{formatDocument(patient)}</span>,
    },
    {
      key: "createdAt",
      header: "Alta",
      align: "right",
      render: (patient) => (
        <span className="tabular-nums text-slate-400">
          {formatClinicDate(patient.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      {/* Patient list — primary work surface, full readable width */}
      <Card className="order-1 min-w-0">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Listado de pacientes
            </span>
          }
          action={
            patients.length > 0 ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {patients.length}
              </span>
            ) : null
          }
        />
        <CardBody className="space-y-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Local filter — its own full-width row so it never overflows the card */}
          <form onSubmit={onSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Filtrar listado por nombre o documento"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </div>
            <Button type="submit" variant="secondary" className="shrink-0">
              Filtrar
            </Button>
          </form>

          {loading ? (
            <p className="px-1 py-10 text-center text-sm text-slate-400">Cargando pacientes…</p>
          ) : (
            <DataTable
              columns={columns}
              rows={patients}
              getKey={(patient) => patient.id}
              emptyMessage="Sin pacientes para mostrar."
            />
          )}
        </CardBody>
      </Card>

      {/* New patient — premium side rail; drops below the list on narrow widths */}
      <Card className="order-2 min-w-0 self-start xl:sticky xl:top-20">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Nuevo paciente
            </span>
          }
        />
        <CardBody>
          <p className="mb-5 text-sm leading-relaxed text-slate-500">
            Completá los datos para dar de alta al paciente. Solo el nombre es obligatorio.
          </p>

          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="Nombre completo *" icon={<User className="h-4 w-4" />}>
              <input
                required
                placeholder="Ej: Ana Pérez"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Sexo">
                <select
                  value={form.sex}
                  onChange={(event) => setForm((current) => ({ ...current, sex: event.target.value }))}
                  className={cn(FIELD_CONTROL, "px-3.5")}
                >
                  <option value="">Seleccionar…</option>
                  {PATIENT_SEX_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tipo de documento">
                <select
                  value={form.documentType}
                  onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
                  className={cn(FIELD_CONTROL, "px-3.5")}
                >
                  <option value="">Seleccionar…</option>
                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Número de documento" icon={<Hash className="h-4 w-4" />}>
              <input
                placeholder="Ej: 10203040"
                value={form.documentNumber}
                onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </Field>

            <Field label="Fecha de nacimiento" icon={<Calendar className="h-4 w-4" />}>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </Field>

            <Field label="Teléfono" icon={<Phone className="h-4 w-4" />}>
              <input
                placeholder="Ej: +57 300 000 0000"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </Field>

            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                placeholder="Ej: paciente@email.com"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className={cn(FIELD_CONTROL, "pl-11 pr-3.5")}
              />
            </Field>

            <label className="flex flex-col gap-1.5">
              <span className={FIELD_LABEL}>Notas</span>
              <textarea
                placeholder="Observaciones clínicas o administrativas"
                value={form.notes}
                rows={3}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-brand/40 focus:bg-white focus:ring-2 focus:ring-brand/10"
              />
            </label>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <Button type="submit" variant="primary" disabled={saving}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {saving ? "Guardando…" : "Crear paciente"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
