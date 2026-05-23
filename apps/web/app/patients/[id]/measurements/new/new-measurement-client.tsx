"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

        <main className="flex-1 flex items-start justify-center p-6">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Contexto de medición</h2>
            <p className="text-sm text-slate-500 mb-5">
              Completá los datos generales para iniciar la sesión de toma de medidas.
            </p>

            {error ? (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            ) : null}

            <form onSubmit={createDraft} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Fecha y hora *
                </span>
                <input
                  type="datetime-local"
                  required
                  value={measuredAt}
                  onChange={(event) => setMeasuredAt(event.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 transition"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Tipo de prenda
                </span>
                <input
                  value={garmentType}
                  onChange={(event) => setGarmentType(event.target.value)}
                  placeholder="Ej: Media hasta rodilla"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 transition"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Clase de compresión
                </span>
                <input
                  value={compressionClass}
                  onChange={(event) => setCompressionClass(event.target.value)}
                  placeholder="Ej: Clase II"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 transition"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Diagnóstico
                </span>
                <input
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Ej: Insuficiencia venosa"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 transition"
                />
              </label>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Notas
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200 transition resize-none"
                />
              </label>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saveStatus === "saving"}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveStatus === "saving" ? "Creando..." : "Iniciar toma de medidas →"}
                </button>
              </div>
            </form>
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
