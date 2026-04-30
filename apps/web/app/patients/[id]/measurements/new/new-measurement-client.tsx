"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BodyHighlight } from "@/app/_components/body-highlight/body-highlight";
import type { AnatomyZoneId } from "@/lib/compression-measurements";
import type { TemplateSnapshot } from "@/lib/measurements";

import styles from "../../../page.module.css";
import {
  buildMeasurementTableRows,
  getActiveZoneIdForField,
  type MeasurementUiField,
  type MeasurementUiGroup,
} from "../measurements-ui";

type DraftResponse = {
  id: string;
  templateSnapshot: TemplateSnapshot;
};

type DraftState = DraftResponse & {
  valuesByKey: Record<string, string>;
};

type NewMeasurementClientProps = {
  patientId: string;
  patientName: string;
};

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

function GroupTable({
  group,
  draft,
  onValueChange,
  onActiveFieldChange,
}: {
  group: MeasurementUiGroup;
  draft: DraftState;
  onValueChange: (key: string, value: string) => void;
  onActiveFieldChange: (field: MeasurementUiField | null) => void;
}) {
  const rows = buildMeasurementTableRows(draft.templateSnapshot, group, {});
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
                <MeasurementInputCell
                  label="Derecha"
                  field={row.right}
                  value={row.right ? draft.valuesByKey[row.right.key] ?? "" : ""}
                  onValueChange={onValueChange}
                  onActiveFieldChange={onActiveFieldChange}
                />
                <MeasurementInputCell
                  label="Izquierda"
                  field={row.left}
                  value={row.left ? draft.valuesByKey[row.left.key] ?? "" : ""}
                  onValueChange={onValueChange}
                  onActiveFieldChange={onActiveFieldChange}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MeasurementInputCell({
  label,
  field,
  value,
  onValueChange,
  onActiveFieldChange,
}: {
  label: string;
  field: MeasurementUiField | null;
  value: string;
  onValueChange: (key: string, value: string) => void;
  onActiveFieldChange: (field: MeasurementUiField | null) => void;
}) {
  if (!field) return <td data-label={label}>—</td>;

  return (
    <td data-label={label}>
      <label className={styles.measurementCellLabel}>
        <span>{field.label}</span>
        <input
          type="number"
          inputMode="decimal"
          min={field.minValue}
          max={field.maxValue}
          step="0.1"
          value={value}
          onFocus={() => onActiveFieldChange(field)}
          onChange={(event) => {
            onActiveFieldChange(field);
            onValueChange(field.key, event.target.value);
          }}
          aria-label={`${field.label} (${field.unit})`}
        />
      </label>
    </td>
  );
}

export default function NewMeasurementClient({ patientId, patientName }: NewMeasurementClientProps) {
  const router = useRouter();
  const [measuredAt, setMeasuredAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [garmentType, setGarmentType] = useState("");
  const [compressionClass, setCompressionClass] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<AnatomyZoneId | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
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
        return;
      }

      const created = (await response.json()) as DraftResponse;
      setDraft({ ...created, valuesByKey: {} });
    } catch {
      setError("No se pudo crear la medición");
    } finally {
      setSaving(false);
    }
  }

  async function saveValues(complete: boolean) {
    if (!draft) return;
    setSaving(true);
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
        return;
      }

      router.push(`/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(draft.id)}`);
      router.refresh();
    } catch {
      setError("No se pudieron guardar las medidas");
    } finally {
      setSaving(false);
    }
  }

  function updateValue(key: string, value: string) {
    setDraft((current) =>
      current ? { ...current, valuesByKey: { ...current.valuesByKey, [key]: value } } : current,
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>MEDIASSWINT · Medición Digital</p>
          <h1>Nueva medición</h1>
          <p className={styles.subtitle}>{patientName}</p>
        </div>
        <Link className={styles.detailLink} href={`/patients/${encodeURIComponent(patientId)}`}>
          Volver al paciente
        </Link>
      </header>

      <section className={styles.card}>
        <h2>Contexto de medición</h2>
        {error ? <p className={styles.error}>{error}</p> : null}
        {!draft ? (
          <form onSubmit={createDraft} className={styles.formGrid}>
            <label>
              Fecha y hora*
              <input
                type="datetime-local"
                required
                value={measuredAt}
                onChange={(event) => setMeasuredAt(event.target.value)}
              />
            </label>
            <label>
              Tipo de prenda
              <input value={garmentType} onChange={(event) => setGarmentType(event.target.value)} />
            </label>
            <label>
              Clase de compresión
              <input value={compressionClass} onChange={(event) => setCompressionClass(event.target.value)} />
            </label>
            <label>
              Diagnóstico
              <input value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
            </label>
            <label className={styles.fullWidthField}>
              Notas
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <button type="submit" disabled={saving} className={styles.primaryButton}>
              {saving ? "Creando..." : "Crear borrador"}
            </button>
          </form>
        ) : (
          <div className={styles.measurementWorkspace}>
            <aside className={styles.bodyHighlightRail} aria-label="Zonas anatómicas">
              <BodyHighlight view="legs" activeZoneId={activeZoneId} />
              <BodyHighlight view="arms" activeZoneId={activeZoneId} />
            </aside>
            <div className={styles.measurementTables}>
              <GroupTable
                group="legs"
                draft={draft}
                onValueChange={updateValue}
                onActiveFieldChange={(field) => setActiveZoneId(getActiveZoneIdForField(field))}
              />
              <GroupTable
                group="arms"
                draft={draft}
                onValueChange={updateValue}
                onActiveFieldChange={(field) => setActiveZoneId(getActiveZoneIdForField(field))}
              />
              <div className={styles.actionsRow}>
                <button type="button" disabled={saving} className={styles.ghostButton} onClick={() => saveValues(false)}>
                  Guardar borrador
                </button>
                <button type="button" disabled={saving} className={styles.primaryButton} onClick={() => saveValues(true)}>
                  Finalizar medición
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
