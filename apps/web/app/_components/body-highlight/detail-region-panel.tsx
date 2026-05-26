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

export function DetailRegionPanel({ region }: DetailRegionPanelProps) {
  const summary = findRegionSummary(region);
  const fields = getPendingFieldsForRegion(region);

  return (
    <section className={styles.pendingPanel} aria-label={`Campos pendientes — ${summary.label}`}>
      <header className={styles.pendingHeader}>
        <div>
          <p className={styles.pendingKicker}>Catálogo PDF</p>
          <h3 className={styles.pendingTitle}>{summary.label}</h3>
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
