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

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {fields.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500">
            No hay campos catalogados en el PDF para esta región.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {fields.map((field) => {
              const value = draftByKey[field.key] ?? "";
              const isFilled = value.trim().length > 0;
              const sideLabel = sideTagFor(field.side);
              const acceptsNumber = field.kind !== "product" && field.kind !== "flag";

              return (
                <div key={field.key} className="hover:bg-slate-50">
                  <div className="flex items-center gap-2 px-2 py-2">
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold uppercase select-none ${
                        isFilled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {KIND_LABEL[field.kind].slice(0, 3)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="truncate text-xs font-semibold text-slate-700">
                          {field.label}
                        </label>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
                          className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-sm outline-none transition-all ${
                            isFilled
                              ? "border-emerald-300 bg-emerald-50 text-slate-800"
                              : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                          }`}
                        />
                        <span className="w-10 shrink-0 text-center text-[10px] font-medium uppercase text-slate-400">
                          {field.unit && field.unit !== "n/a" ? field.unit : "·"}
                        </span>
                      </div>

                      {sideLabel ? (
                        <div className="mt-1 text-[10px] font-medium text-slate-500">
                          {sideLabel}
                        </div>
                      ) : null}
                    </div>
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
