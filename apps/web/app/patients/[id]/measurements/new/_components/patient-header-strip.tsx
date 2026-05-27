"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, User, Calendar, CheckCircle2, Save } from "lucide-react";
import Link from "next/link";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type PatientHeaderStripProps = {
  patientId: string;
  patientName: string;
  measuredAt: string;
  saveStatus: SaveStatus;
};

function SaveStatusPill({ status }: { status: SaveStatus }) {
  const config = {
    idle: null,
    saving: { label: "Guardando...", color: "bg-blue-100 text-blue-700 border-blue-200" },
    saved: { label: "Guardado", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    error: { label: "Error al guardar", color: "bg-red-100 text-red-700 border-red-200" },
  }[status];

  return (
    <AnimatePresence mode="wait">
      {config ? (
        <motion.div
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${config.color}`}
        >
          {status === "saving" ? (
            <Save className="w-3.5 h-3.5 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          {config.label}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function PatientHeaderStrip({
  patientId,
  patientName,
  measuredAt,
  saveStatus,
}: PatientHeaderStripProps) {
  const formattedDate = measuredAt
    ? new Date(measuredAt).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          href={`/patients/${encodeURIComponent(patientId)}`}
          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-red-700 transition-colors shrink-0"
          aria-label="Volver al paciente"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver</span>
        </Link>

        <div className="w-px h-6 bg-slate-200 shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{patientName}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Nueva medición</p>
          </div>
        </div>

        {formattedDate ? (
          <>
            <div className="w-px h-6 bg-slate-200 shrink-0 hidden md:block" />
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <SaveStatusPill status={saveStatus} />
          <span className="text-xs font-bold text-red-700 tracking-widest uppercase hidden sm:inline">
            MEDIASSWINT
          </span>
        </div>
      </div>
    </header>
  );
}
