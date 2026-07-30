"use client";

import type { MpBermudaFieldStripItem } from "../../measurements-ui";

/**
 * Textual fallback for MP/Bermuda capture.
 *
 * Everything a clinician needs to record a value — which measurement, on which
 * leg, between which landmarks, whether it is required, whether it is already
 * taken, and why it was rejected — is plain text and native form semantics
 * here. No SVG, no position and no colour carries meaning, so the session stays
 * capturable with the drawing unavailable, CSS off, or a screen reader driving.
 *
 * `activeFieldKey` is REPRESENTED, never orchestrated: this strip reports the
 * active field's state and owns no synchronization with the drawing.
 */

type MpBermudaFieldStripProps = {
  items: ReadonlyArray<MpBermudaFieldStripItem>;
  valuesByKey: Record<string, string>;
  errorsByKey?: Record<string, string>;
  activeFieldKey?: string | null;
  onFocus?: (key: string) => void;
  onChange: (key: string, value: string) => void;
};

/** DOM id of a field's input. The one place the drawing and the strip agree on. */
export function mpBermudaFieldInputId(key: string): string {
  return `mp-field-${key}`;
}

// Takes the document instead of reaching for the global, so the marker-to-input
// bridge stays testable and safe on the server, where there is no document.
export function focusMpBermudaField(
  key: string,
  doc: Pick<Document, "getElementById"> | null,
): void {
  const input = doc?.getElementById(mpBermudaFieldInputId(key));
  if (input instanceof Object && typeof input.focus === "function") input.focus();
}

const SIDE_LABEL: Readonly<Record<string, string>> = {
  right: "Lado derecho",
  left: "Lado izquierdo",
  shared: "Medida compartida",
};

const MISSING_CONTEXT_LABEL = "Sin contexto anatómico disponible";

/** Side, station and endpoints as one readable line — the drawing's replacement. */
function contextLine(item: MpBermudaFieldStripItem): string {
  const parts = [item.side ? SIDE_LABEL[item.side] : null, item.station, item.endpoints];
  const context = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return context.length > 0 ? context : MISSING_CONTEXT_LABEL;
}

export function MpBermudaFieldStrip({
  items,
  valuesByKey,
  errorsByKey = {},
  activeFieldKey = null,
  onFocus,
  onChange,
}: MpBermudaFieldStripProps) {
  return (
    <section aria-label="Medidas de media pantalón y bermuda" className="flex min-h-0 flex-col">
      <ul className="flex flex-col gap-1.5 p-2 sm:p-2.5">
        {items.map((item) => {
          const value = valuesByKey[item.key] ?? "";
          const isFilled = value.trim().length > 0;
          const isActive = item.key === activeFieldKey;
          const error = errorsByKey[item.key];
          const inputId = mpBermudaFieldInputId(item.key);
          const contextId = `${inputId}-context`;
          const errorId = `${inputId}-error`;

          return (
            <li
              key={item.key}
              data-mp-field-key={item.key}
              data-mp-field-state={isActive ? "active" : isFilled ? "filled" : "pending"}
              data-filled={isFilled ? "true" : undefined}
              aria-current={isActive ? ("true" as const) : undefined}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 sm:py-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={inputId} className="text-[13px] font-semibold text-slate-700 sm:text-xs">
                  {item.label}
                </label>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {isActive ? "Activa" : isFilled ? "Medida" : "Pendiente"}
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                <span>{item.isRequired ? "Obligatoria" : "Opcional"}</span>{" "}
                <span id={contextId}>{contextLine(item)}</span>
              </p>

              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  type="number"
                  inputMode="decimal"
                  min={item.minValue}
                  max={item.maxValue}
                  step="0.1"
                  value={value}
                  required={item.isRequired}
                  aria-required={item.isRequired}
                  aria-invalid={error ? "true" : undefined}
                  aria-describedby={error ? `${contextId} ${errorId}` : contextId}
                  onFocus={() => onFocus?.(item.key)}
                  onChange={(event) => {
                    onFocus?.(item.key);
                    onChange(item.key, event.target.value);
                  }}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 font-mono text-base text-slate-800 lg:text-sm"
                />
                <span className="w-7 text-center text-xs font-medium text-slate-400">{item.unit}</span>
              </div>

              {error ? (
                <p id={errorId} role="alert" className="text-[11px] font-medium text-red-700">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
