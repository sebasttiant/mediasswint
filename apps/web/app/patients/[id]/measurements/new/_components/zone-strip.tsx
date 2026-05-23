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
    <div className="flex flex-col h-full">
      <div className={`sticky top-[57px] z-10 px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-center border-b ${
        side === "right"
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "bg-violet-50 text-violet-700 border-violet-200"
      }`}>
        {label}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {fields.map((field) => {
              const anatomyZone = field.metadata.anatomyZone as string | undefined;
              const isActive = anatomyZone ? anatomyZone === activeZoneId : false;
              const value = valuesByKey[field.key] ?? "";
              const point = field.metadata.point;

              return (
                <tr
                  key={field.key}
                  className={`border-b border-slate-100 transition-colors ${
                    isActive ? "bg-sky-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className={`w-7 text-center font-mono font-bold py-0.5 pl-1 select-none ${
                    isActive ? "text-sky-700" : "text-slate-400"
                  }`}>
                    {typeof point === "number" ? point : "·"}
                  </td>
                  <td className="pr-1 py-0.5">
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
                      className={`w-full px-1.5 py-0.5 rounded border text-xs font-mono transition-all outline-none ${
                        isActive
                          ? "border-sky-400 bg-sky-50 ring-1 ring-sky-300 text-sky-900"
                          : value
                            ? "border-emerald-300 bg-emerald-50 text-slate-800"
                            : "border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                      }`}
                    />
                  </td>
                  <td className="w-7 text-center text-slate-400 py-0.5 pr-1">
                    {field.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
