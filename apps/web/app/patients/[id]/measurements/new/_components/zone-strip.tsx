"use client";

import type { MeasurementUiField } from "../../measurements-ui";

type ZoneStripProps = {
  side: "right" | "left";
  limb: "leg" | "arm";
  fields: MeasurementUiField[];
  valuesByKey: Record<string, string>;
  activeZoneId: string | null;
  onFocus: (zoneId: string) => void;
  onChange: (key: string, value: string) => void;
};

const LIMB_LABELS = {
  leg: { right: "Pierna Derecha", left: "Pierna Izquierda" },
  arm: { right: "Brazo Derecho", left: "Brazo Izquierdo" },
} as const;

const SUBTITLE = "Circunferencias en cm";

export function ZoneStrip({
  side,
  limb,
  fields,
  valuesByKey,
  activeZoneId,
  onFocus,
  onChange,
}: ZoneStripProps) {
  const label = LIMB_LABELS[limb][side];
  const total = fields.length;
  const filled = fields.reduce((acc, f) => {
    const v = valuesByKey[f.key] ?? "";
    return v.trim().length > 0 ? acc + 1 : acc;
  }, 0);
  const accent =
    side === "right"
      ? { ring: "ring-sky-100", text: "text-sky-700", chip: "bg-sky-50 text-sky-700 border-sky-200" }
      : { ring: "ring-violet-100", text: "text-violet-700", chip: "bg-violet-50 text-violet-700 border-violet-200" };

  return (
    <section
      className={`flex h-full min-h-0 flex-col bg-white ring-1 ring-inset ${accent.ring}`}
      aria-label={`${label} — ${filled} de ${total} medidas`}
    >
      <header className="shrink-0 border-b border-slate-100 bg-white px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={`truncate text-[13px] font-bold tracking-tight ${accent.text}`}>{label}</h3>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${accent.chip}`}
            aria-label={`${filled} de ${total} puntos completados`}
          >
            {filled}/{total}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {SUBTITLE}
        </p>
      </header>

      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto bg-white">
        {fields.map((field) => {
          const anatomyZone = field.metadata.anatomyZone as string | undefined;
          const isActive = anatomyZone ? anatomyZone === activeZoneId : false;
          const value = valuesByKey[field.key] ?? "";
          const point = field.metadata.point;
          const isFilled = value.trim().length > 0;
          const pointText = typeof point === "number" ? point : "·";

          return (
            <li
              key={field.key}
              className={`transition-colors ${
                isActive ? "bg-sky-50/70" : "hover:bg-slate-50/60"
              }`}
            >
              <div className="flex items-center gap-2.5 px-3 py-1.5">
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold tabular-nums select-none ring-1 ${
                    isActive
                      ? "bg-sky-600 text-white ring-sky-700"
                      : isFilled
                        ? "bg-white text-emerald-700 ring-emerald-300"
                        : "bg-white text-slate-400 ring-slate-200"
                  }`}
                  aria-hidden="true"
                >
                  {pointText}
                </div>

                <label
                  htmlFor={field.key}
                  className="sr-only"
                >
                  {field.label}
                </label>

                <input
                  id={field.key}
                  type="number"
                  inputMode="decimal"
                  min={field.minValue}
                  max={field.maxValue}
                  step="0.1"
                  value={value}
                  placeholder="—"
                  aria-label={`${field.label} en ${field.unit}`}
                  data-anatomy-zone={anatomyZone ?? undefined}
                  onFocus={() => {
                    if (anatomyZone) onFocus(anatomyZone);
                  }}
                  onChange={(event) => {
                    if (anatomyZone) onFocus(anatomyZone);
                    onChange(field.key, event.target.value);
                  }}
                  className={`min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-right font-mono text-sm tabular-nums outline-none transition-all placeholder:text-slate-300 ${
                    isActive
                      ? "border-sky-400 bg-white text-sky-950 ring-2 ring-sky-100"
                      : isFilled
                        ? "border-slate-200 bg-white text-slate-900"
                        : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                  }`}
                />

                <span className="w-7 shrink-0 text-left text-[10px] font-medium uppercase text-slate-400">
                  {field.unit}
                </span>

                {/* Sutil indicador de estado — un punto chico, no un cartel. */}
                <span
                  aria-hidden="true"
                  className={`block size-1.5 shrink-0 rounded-full transition-colors ${
                    isActive
                      ? "bg-sky-500"
                      : isFilled
                        ? "bg-emerald-500"
                        : "bg-slate-200"
                  }`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
