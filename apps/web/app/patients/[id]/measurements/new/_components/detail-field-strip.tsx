"use client";

import type { PdfMeasurementField } from "@/lib/body-anatomy";

type DetailFieldStripProps = {
  title: string;
  fields: ReadonlyArray<PdfMeasurementField>;
  draftByKey: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
  tone?: "right" | "left" | "neutral";
};

const KIND_LABEL: Record<PdfMeasurementField["kind"], string> = {
  perimeter: "Perímetro",
  length: "Largo",
  circumference: "Contorno",
  product: "Producto",
  flag: "Marcador",
};

const TONE_HEADER: Record<NonNullable<DetailFieldStripProps["tone"]>, string> = {
  right: "bg-sky-50 text-sky-700 border-sky-200",
  left: "bg-violet-50 text-violet-700 border-violet-200",
  neutral: "bg-slate-50 text-slate-700 border-slate-200",
};

function sideTagFor(side: PdfMeasurementField["side"]): string | null {
  if (!side) return null;
  if (side === "right") return "Derecho";
  if (side === "left") return "Izquierdo";
  return "Bilateral";
}

export function DetailFieldStrip({
  title,
  fields,
  draftByKey,
  onDraftChange,
  tone = "neutral",
}: DetailFieldStripProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`shrink-0 border-b px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider ${TONE_HEADER[tone]}`}
      >
        {title}
      </div>

      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-800">
        Borrador — estos campos aún no se persisten al guardar.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        {fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No hay campos catalogados en el PDF para esta región.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 p-3">
            {fields.map((field) => {
              const value = draftByKey[field.key] ?? "";
              const isFilled = value.trim().length > 0;
              const sideLabel = sideTagFor(field.side);
              const acceptsNumber = field.kind !== "product" && field.kind !== "flag";
              const meta = [KIND_LABEL[field.kind], sideLabel].filter(Boolean).join(" · ");

              return (
                <div
                  key={field.key}
                  className={`rounded-xl border bg-white p-3 transition-colors ${
                    isFilled ? "border-emerald-200" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <label className="block text-sm font-semibold text-slate-800">
                        {field.label}
                      </label>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {meta}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isFilled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isFilled ? "Anotada" : "Pendiente"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type={acceptsNumber ? "number" : "text"}
                      inputMode={acceptsNumber ? "decimal" : "text"}
                      step={acceptsNumber ? "0.1" : undefined}
                      value={value}
                      aria-label={`${field.label}${field.unit ? ` (${field.unit})` : ""}`}
                      onChange={(event) => onDraftChange(field.key, event.target.value)}
                      className={`h-10 min-w-0 flex-1 rounded-lg border px-3 font-mono text-sm outline-none transition-all ${
                        isFilled
                          ? "border-emerald-300 bg-emerald-50 text-slate-800"
                          : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      }`}
                    />
                    <span className="w-10 shrink-0 text-center text-[11px] font-semibold uppercase text-slate-400">
                      {field.unit && field.unit !== "n/a" ? field.unit : "·"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
