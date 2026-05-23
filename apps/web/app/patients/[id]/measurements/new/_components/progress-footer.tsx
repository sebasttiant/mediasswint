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
    <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-0">
            <motion.div
              className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-sky-500"}`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap shrink-0">
            {filledCount}
            <span className="text-slate-400 font-normal"> / {totalCount}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Guardar borrador</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onComplete}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finalizar</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
