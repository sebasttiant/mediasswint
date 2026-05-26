"use client";

import {
  type AnatomicalRegion,
  type PdfMeasurementField,
  findRegionSummary,
  getPendingFieldsForRegion,
} from "@/lib/body-anatomy";

import styles from "./body-highlight.module.css";

type DetailRegionPanelProps = {
  region: AnatomicalRegion;
  // When set, the panel narrows to fields matching this laterality plus
  // any bilateral entries. Region without laterality (head, neck) ignore
  // this prop. `null` keeps the legacy "show all fields" behavior.
  side?: "right" | "left" | null;
};

const KIND_LABEL: Record<PdfMeasurementField["kind"], string> = {
  perimeter: "Perímetro",
  length: "Largo",
  circumference: "Contorno",
  product: "Producto",
  flag: "Marcador",
};

function SideTag({ side }: { side: PdfMeasurementField["side"] }) {
  if (!side) return null;
  const text = side === "right" ? "Derecho" : side === "left" ? "Izquierdo" : "Bilateral";
  return <span className={styles.pendingSide}>{text}</span>;
}

export function DetailRegionPanel({ region, side = null }: DetailRegionPanelProps) {
  const summary = findRegionSummary(region);
  const allFields = getPendingFieldsForRegion(region);
  const fields = side
    ? allFields.filter((f) => f.side === side || f.side === "bilateral" || !f.side)
    : allFields;

  const sidedLabel =
    region === "hands" && side === "right"
      ? "Mano Derecha"
      : region === "hands" && side === "left"
        ? "Mano Izquierda"
        : summary.label;

  return (
    <section className={styles.pendingPanel} aria-label={`Campos pendientes — ${sidedLabel}`}>
      <header className={styles.pendingHeader}>
        <div>
          <p className={styles.pendingKicker}>Catálogo PDF</p>
          <h3 className={styles.pendingTitle}>{sidedLabel}</h3>
          <p className={styles.pendingDescription}>{summary.description}</p>
        </div>
        <span className={styles.pendingBadge} data-status={summary.status}>
          {summary.status === "implemented"
            ? "Implementado"
            : summary.status === "partial"
              ? "Parcial"
              : "Pendiente"}
        </span>
      </header>

      {fields.length > 0 ? (
        <ul className={styles.pendingList}>
          {fields.map((field) => (
            <li key={field.key} className={styles.pendingItem} data-status="pending">
              <span className={styles.pendingItemLabel}>{field.label}</span>
              <span className={styles.pendingItemMeta}>
                <span className={styles.pendingKind}>{KIND_LABEL[field.kind]}</span>
                <SideTag side={field.side} />
                {field.unit && field.unit !== "n/a" ? (
                  <span className={styles.pendingUnit}>{field.unit}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.pendingEmpty}>Sin campos catalogados en el PDF para esta región.</p>
      )}

      <p className={styles.pendingFootnote}>
        Estos campos provienen de la ficha clínica impresa y aún no están conectados al
        almacenamiento. Quedan visibles como referencia anatómica.
      </p>
    </section>
  );
}
