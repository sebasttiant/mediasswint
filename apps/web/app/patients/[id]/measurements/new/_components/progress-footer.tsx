"use client";

import { motion } from "framer-motion";
import { Save, CheckCircle2 } from "lucide-react";

type ProgressFooterProps = {
  filledCount: number;
  totalCount: number;
  saving: boolean;
  onSaveDraft: () => void;
  onComplete: () => void;
};

export function ProgressFooter({
  filledCount,
  totalCount,
  saving,
  onSaveDraft,
  onComplete,
}: ProgressFooterProps) {
  const percentage = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  const isComplete = filledCount === totalCount && totalCount > 0;

  return (
    <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <span className="flex-1">Progreso de la toma de medidas</span>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {filledCount}/{totalCount} zonas
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-sky-500"}`}
              initial={false}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {isComplete
              ? "Todas las zonas están registradas. Ya podés cerrar la sesión."
              : `${percentage}% completado. Podés guardar borrador o finalizar con pendientes si el caso clínico lo requiere.`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Guardar borrador</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onComplete}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto ${
              isComplete ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isComplete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar sesión</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar con pendientes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
