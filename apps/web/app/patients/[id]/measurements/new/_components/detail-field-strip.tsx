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

const TONE: Record<NonNullable<DetailFieldStripProps["tone"]>, { ring: string; text: string; chip: string }> = {
  right: {
    ring: "ring-sky-100",
    text: "text-sky-700",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  left: {
    ring: "ring-violet-100",
    text: "text-violet-700",
    chip: "bg-violet-50 text-violet-700 border-violet-200",
  },
  neutral: {
    ring: "ring-slate-200",
    text: "text-slate-700",
    chip: "bg-slate-50 text-slate-600 border-slate-200",
  },
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
  const filled = fields.reduce((acc, f) => {
    const v = draftByKey[f.key] ?? "";
    return v.trim().length > 0 ? acc + 1 : acc;
  }, 0);
  const total = fields.length;
  const t = TONE[tone];

  return (
    <section
      className={`flex h-full min-h-0 flex-col bg-white ring-1 ring-inset ${t.ring}`}
      aria-label={`${title} — ${filled} de ${total} campos en borrador`}
    >
      <header className="shrink-0 border-b border-slate-100 bg-white px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={`truncate text-[13px] font-bold tracking-tight ${t.text}`}>{title}</h3>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${t.chip}`}
            aria-label={`${filled} de ${total} campos completados`}
          >
            {filled}/{total}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          Catálogo PDF · cm
        </p>
      </header>

      <div className="shrink-0 border-b border-amber-200/70 bg-amber-50/70 px-3 py-1.5 text-[10px] font-medium leading-snug text-amber-800">
        Borrador local — estos campos aún no se persisten al guardar.
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto bg-white">
        {fields.length === 0 ? (
          <li className="px-3 py-4 text-xs text-slate-500">
            No hay campos catalogados en el PDF para esta región.
          </li>
        ) : (
          fields.map((field) => {
            const value = draftByKey[field.key] ?? "";
            const isFilled = value.trim().length > 0;
            const sideLabel = sideTagFor(field.side);
            const acceptsNumber = field.kind !== "product" && field.kind !== "flag";
            const kindShort = KIND_LABEL[field.kind];

            return (
              <li key={field.key} className="hover:bg-slate-50/60">
                <div className="flex flex-col gap-1.5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`draft-${field.key}`}
                      className="truncate text-[13px] font-semibold text-slate-800"
                    >
                      {field.label}
                    </label>
                    <span
                      className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500"
                      aria-hidden="true"
                    >
                      {kindShort}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id={`draft-${field.key}`}
                      type={acceptsNumber ? "number" : "text"}
                      inputMode={acceptsNumber ? "decimal" : "text"}
                      step={acceptsNumber ? "0.1" : undefined}
                      value={value}
                      placeholder="—"
                      aria-label={`${field.label}${field.unit ? ` en ${field.unit}` : ""}`}
                      onChange={(event) => onDraftChange(field.key, event.target.value)}
                      className={`min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-right font-mono text-sm tabular-nums outline-none transition-all placeholder:text-slate-300 ${
                        isFilled
                          ? "border-slate-200 bg-white text-slate-900"
                          : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                      }`}
                    />
                    <span className="w-9 shrink-0 text-left text-[10px] font-medium uppercase text-slate-400">
                      {field.unit && field.unit !== "n/a" ? field.unit : "—"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`block size-1.5 shrink-0 rounded-full transition-colors ${
                        isFilled ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  </div>

                  {sideLabel ? (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      {sideLabel}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
