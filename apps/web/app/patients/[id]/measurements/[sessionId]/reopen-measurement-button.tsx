"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil } from "lucide-react";

import { Modal } from "@/app/_components/ui/modal";

/**
 * Admin-only "modify completed measurement" action. Shows an explicit
 * confirmation before reopening, because correcting a COMPLETED record is a
 * privileged, audited operation. On confirm it calls the admin reopen endpoint
 * (COMPLETED → DRAFT) and navigates to the edit screen of the same measurement.
 */
export function ReopenMeasurementButton({
  patientId,
  sessionId,
}: {
  patientId: string;
  sessionId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReopen() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(sessionId)}/reopen`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(
          response.status === 403
            ? "No tenés permisos para modificar una medición completada."
            : "No se pudo abrir la medición para edición.",
        );
        setPending(false);
        return;
      }
      const json = (await response.json()) as { editHref: string };
      router.push(json.editHref);
      router.refresh();
    } catch {
      setError("No se pudo abrir la medición para edición.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        <Pencil size={15} aria-hidden="true" />
        Modificar medición
      </button>

      <Modal
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title="Modificar medición completa"
        eyebrow="Acción de administrador"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Esta medición ya está completa. ¿Está seguro de modificarla? La medición volverá a
              estado borrador para su corrección y la acción queda registrada en auditoría.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmReopen}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Abriendo…" : "Sí, modificar"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default ReopenMeasurementButton;
