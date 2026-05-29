"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";

import { BODY_FIGURE_SEX, type BodyFigureSex } from "@/app/_components/body-highlight/body-highlight";
import type { TemplateSnapshot } from "@/lib/measurements";

import {
  getFilledZoneIdsFromValues,
} from "../measurements-ui";
import { PatientHeaderStrip } from "./_components/patient-header-strip";
import { MeasurementShell } from "./_components/measurement-shell";
import { ProgressFooter } from "./_components/progress-footer";

type DraftResponse = {
  id: string;
  templateSnapshot: TemplateSnapshot;
};

type DraftState = DraftResponse & {
  valuesByKey: Record<string, string>;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type NewMeasurementClientProps = {
  patientId: string;
  patientName: string;
  patientSex: string | null;
};

function toBodyFigureSex(patientSex: string | null): BodyFigureSex {
  return patientSex === "MALE" ? BODY_FIGURE_SEX.MALE : BODY_FIGURE_SEX.FEMALE;
}

function toDatetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoInstant(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

function valuesPayload(valuesByKey: Record<string, string>): Record<string, number | null> {
  const payload: Record<string, number | null> = {};
  for (const [key, raw] of Object.entries(valuesByKey)) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    payload[key] = Number(trimmed);
  }
  return payload;
}

function countTotalZones(templateSnapshot: TemplateSnapshot): number {
  let total = 0;
  for (const section of templateSnapshot.sections) {
    total += section.fields.length;
  }
  return total;
}

export default function NewMeasurementClient({ patientId, patientName, patientSex }: NewMeasurementClientProps) {
  const router = useRouter();
  const [measuredAt, setMeasuredAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [garmentType, setGarmentType] = useState("");
  const [compressionClass, setCompressionClass] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const bodyFigureSex = toBodyFigureSex(patientSex);

  const filledCount = draft
    ? getFilledZoneIdsFromValues(draft.templateSnapshot, draft.valuesByKey).size
    : 0;

  const totalCount = draft ? countTotalZones(draft.templateSnapshot) : 0;

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus("saving");
    setError(null);

    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          measuredAt: toIsoInstant(measuredAt),
          garmentType,
          compressionClass,
          diagnosis,
          notes,
          productFlags: null,
        }),
      });

      if (!response.ok) {
        setError("No se pudo crear la medición. Revisá los datos iniciales.");
        setSaveStatus("error");
        return;
      }

      const created = (await response.json()) as DraftResponse;
      setDraft({ ...created, valuesByKey: {} });
      setSaveStatus("idle");
    } catch {
      setError("No se pudo crear la medición");
      setSaveStatus("error");
    }
  }

  async function saveValues(complete: boolean) {
    if (!draft) return;
    setSaveStatus("saving");
    setError(null);

    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(draft.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ valuesByKey: valuesPayload(draft.valuesByKey), complete }),
        },
      );

      if (!response.ok) {
        setError("No se pudieron guardar las medidas. Revisá rangos y campos.");
        setSaveStatus("error");
        return;
      }

      setSaveStatus("saved");
      router.push(`/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(draft.id)}`);
      router.refresh();
    } catch {
      setError("No se pudieron guardar las medidas");
      setSaveStatus("error");
    }
  }

  function updateValue(key: string, value: string) {
    setDraft((current) =>
      current ? { ...current, valuesByKey: { ...current.valuesByKey, [key]: value } } : current,
    );
  }

  if (!draft) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        <PatientHeaderStrip
          patientId={patientId}
          patientName={patientName}
          measuredAt={measuredAt}
          saveStatus={saveStatus}
        />

        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Session context rail — orients the clinician inside the flow */}
            <aside className="flex h-fit flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <User className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{patientName}</p>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Nueva sesión de medición
                  </p>
                </div>
              </div>

              <ol className="flex flex-col gap-1">
                {[
                  { n: 1, label: "Contexto", desc: "Datos de la sesión", active: true },
                  { n: 2, label: "Medición", desc: "Toma de medidas por zona", active: false },
                  { n: 3, label: "Cierre", desc: "Guardar borrador o finalizar", active: false },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-3 px-1 py-1.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        step.active ? "bg-red-700 text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {step.n}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          step.active ? "text-slate-900" : "text-slate-500"
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-slate-400">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="text-xs leading-relaxed text-slate-500">
                Completá el contexto clínico para iniciar la toma de medidas. Durante la sesión vas
                a poder guardar borrador o finalizar con pendientes.
              </p>
            </aside>

            {/* Context form */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                <h2 className="text-base font-bold text-slate-900">Contexto de medición</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Datos generales que encabezan la sesión de toma de medidas.
                </p>
              </div>

              <form onSubmit={createDraft} className="p-6">
                {error ? (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Fecha y hora *
                    </span>
                    <input
                      type="datetime-local"
                      required
                      value={measuredAt}
                      onChange={(event) => setMeasuredAt(event.target.value)}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Tipo de prenda
                    </span>
                    <input
                      value={garmentType}
                      onChange={(event) => setGarmentType(event.target.value)}
                      placeholder="Ej: Media hasta rodilla"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Clase de compresión
                    </span>
                    <input
                      value={compressionClass}
                      onChange={(event) => setCompressionClass(event.target.value)}
                      placeholder="Ej: Clase II"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Diagnóstico
                    </span>
                    <input
                      value={diagnosis}
                      onChange={(event) => setDiagnosis(event.target.value)}
                      placeholder="Ej: Insuficiencia venosa"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Notas
                    </span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                      className="resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
                  <button
                    type="submit"
                    disabled={saveStatus === "saving"}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveStatus === "saving" ? "Creando..." : "Iniciar toma de medidas →"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-white">
      <PatientHeaderStrip
        patientId={patientId}
        patientName={patientName}
        measuredAt={measuredAt}
        saveStatus={saveStatus}
      />

      {error ? (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm text-center">
          {error}
        </div>
      ) : null}

      <MeasurementShell
        templateSnapshot={draft.templateSnapshot}
        valuesByKey={draft.valuesByKey}
        sex={bodyFigureSex}
        onValueChange={updateValue}
        footer={
          <ProgressFooter
            filledCount={filledCount}
            totalCount={totalCount}
            saving={saveStatus === "saving"}
            onSaveDraft={() => saveValues(false)}
            onComplete={() => saveValues(true)}
          />
        }
      />
    </div>
  );
}
