"use client";

import type { MeasurementUiField } from "../../measurements-ui";

type HeadMeasurementFieldStripProps = {
  /** Garment label from the head-view composition (e.g. "Máscara", "Mentonera"). */
  title: string;
  fields: MeasurementUiField[];
  valuesByKey: Record<string, string>;
  activeZoneId: string | null;
  onFocus: (zoneId: string) => void;
  onChange: (key: string, value: string) => void;
};

const KIND_LABEL: Record<string, string> = {
  circumference: "Contorno",
  length: "Largo",
};

// Mirrors ZoneStrip's exact focus/change wiring (data-anatomy-zone -> onFocus
// -> onChange) so the SAME BodyHighlight activate-on-focus / render-as-measured
// mechanism drives head-garment fields. Unlike ZoneStrip, head fields have no
// side/point — a single centered list, no D/I columns, and a
// circumference/length kind badge instead of a point number. Shared by every
// head garment (Mentonera, Máscara); the garment name arrives as `title`.
export function HeadMeasurementFieldStrip({
  title,
  fields,
  valuesByKey,
  activeZoneId,
  onFocus,
  onChange,
}: HeadMeasurementFieldStripProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 sm:py-1.5 sm:text-xs">
        {title}
      </div>

      <div className="flex-1 overflow-visible bg-slate-50 lg:min-h-0 lg:overflow-y-auto">
        <div className="flex flex-col gap-1.5 p-2 sm:p-2.5">
          {fields.map((field) => {
            const anatomyZone = field.metadata.anatomyZone as string | undefined;
            const kind = field.metadata.kind as string | undefined;
            const isActive = anatomyZone ? anatomyZone === activeZoneId : false;
            const value = valuesByKey[field.key] ?? "";
            const isFilled = value.trim().length > 0;

            return (
              <div
                key={field.key}
                className={`rounded-xl border px-2.5 py-1.5 transition-colors sm:py-2 ${
                  isActive
                    ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                    : isFilled
                      ? "border-emerald-200 bg-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex size-7 shrink-0 select-none items-center justify-center rounded-full text-[9px] font-bold uppercase sm:size-8 sm:text-[10px] ${
                      isActive
                        ? "bg-sky-600 text-white"
                        : isFilled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {kind ? (KIND_LABEL[kind] ?? kind).slice(0, 4) : "·"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="truncate text-[13px] font-semibold leading-tight text-slate-700 sm:text-xs">
                        {field.label}
                      </label>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isActive
                            ? "bg-sky-100 text-sky-700"
                            : isFilled
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
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
                        className={`h-9 min-w-0 flex-1 scroll-mb-44 rounded-lg border px-3 font-mono text-base outline-none transition-all lg:scroll-mb-0 lg:text-sm ${
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
