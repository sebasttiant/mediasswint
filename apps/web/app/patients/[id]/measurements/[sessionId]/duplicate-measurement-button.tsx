"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../page.module.css";

export function DuplicateMeasurementButton({ patientId, sessionId }: { patientId: string; sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicateMeasurement() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(sessionId)}/duplicate`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError("No se pudo duplicar la medición.");
        return;
      }

      const json = (await response.json()) as { editHref: string };
      router.push(json.editHref);
      router.refresh();
    } catch {
      setError("No se pudo duplicar la medición.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className={styles.ghostButton} onClick={duplicateMeasurement} disabled={pending}>
        {pending ? "Duplicando..." : "Duplicar medición"}
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
