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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`shrink-0 px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wider border-b ${
        side === "right"
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "bg-violet-50 text-violet-700 border-violet-200"
      }`}>
        {label}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <div className="flex flex-col gap-1.5 p-2.5">
          {fields.map((field) => {
            const anatomyZone = field.metadata.anatomyZone as string | undefined;
            const isActive = anatomyZone ? anatomyZone === activeZoneId : false;
            const value = valuesByKey[field.key] ?? "";
            const point = field.metadata.point;
            const isFilled = value.trim().length > 0;

            return (
              <div
                key={field.key}
                className={`rounded-xl border px-2.5 py-2 transition-colors ${
                  isActive
                    ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                    : isFilled
                      ? "border-emerald-200 bg-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold select-none ${
                    isActive
                      ? "bg-sky-600 text-white"
                      : isFilled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {typeof point === "number" ? point : "·"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="truncate text-xs font-semibold text-slate-700">
                        {field.label}
                      </label>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isActive
                          ? "bg-sky-100 text-sky-700"
                          : isFilled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                      }`}>
                        {isActive ? "Activa" : isFilled ? "Medida" : "Pendiente"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={field.minValue}
                        max={field.maxValue}
                        step="0.1"
                        value={value}
                        aria-label={`${field.label} (${field.unit})`}
                        data-anatomy-zone={anatomyZone ?? undefined}
                        onFocus={() => {
                          if (anatomyZone) onFocus(anatomyZone);
                        }}
                        onChange={(event) => {
                          if (anatomyZone) onFocus(anatomyZone);
                          onChange(field.key, event.target.value);
                        }}
                        className={`h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm font-mono outline-none transition-all ${
                          isActive
                            ? "border-sky-400 bg-white text-sky-950 ring-2 ring-sky-100"
                            : isFilled
                              ? "border-emerald-300 bg-emerald-50 text-slate-800"
                              : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        }`}
                      />
                      <span className="w-7 text-center text-xs font-medium text-slate-400">{field.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
