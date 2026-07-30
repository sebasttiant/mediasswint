"use client";

import type { ReactNode } from "react";

import type { TemplateSnapshot } from "@/lib/measurements";

import { buildMpBermudaFields, buildMpBermudaFieldStripItems } from "../../measurements-ui";
import { MpBermudaFieldStrip } from "./mp-bermuda-field-strip";
import { MpBermudaGuide } from "./mp-bermuda-guide";

/**
 * MP/Bermuda capture composition. Both views project the SAME frozen snapshot:
 * the drawing gets this session's fields explicitly rather than falling back to
 * `MpBermudaGuide`'s canonical default, so a session frozen before a catalog
 * edit keeps asking for what it froze. The shell owns active-field state; this
 * layout only translates between the two identifier spaces — the strip speaks
 * field keys, the drawing speaks marker ids — and derives filled from current
 * values, independently of active, so both may hold for one field. A drawing
 * that cannot resolve its geometry renders nothing by design; the strip is
 * unaffected and the session stays capturable.
 */

type MpBermudaShellLayoutProps = {
  snapshot: TemplateSnapshot;
  valuesByKey: Record<string, string>;
  errorsByKey?: Record<string, string>;
  activeFieldKey: string | null;
  onFocus: (key: string) => void;
  onMarkerActivate: (key: string) => void;
  onChange: (key: string, value: string) => void;
  footer?: ReactNode;
};

function isFilled(value: string | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

export function MpBermudaShellLayout({
  snapshot,
  valuesByKey,
  errorsByKey,
  activeFieldKey,
  onFocus,
  onMarkerActivate,
  onChange,
  footer,
}: MpBermudaShellLayoutProps) {
  const fields = buildMpBermudaFields(snapshot);

  if (fields.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <p role="status" className="m-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta sesión no tiene medidas utilizables. No se puede completar hasta regenerar la plantilla.
        </p>
        {footer}
      </div>
    );
  }

  const markerIdByKey = new Map(
    fields.map((f) => [f.key, typeof f.metadata.markerId === "string" ? f.metadata.markerId : null]),
  );
  const activeMarkerId = activeFieldKey ? markerIdByKey.get(activeFieldKey) ?? null : null;
  const filledMarkerIds = new Set(
    fields
      .filter((f) => isFilled(valuesByKey[f.key]))
      .map((f) => markerIdByKey.get(f.key))
      .filter((id): id is string => Boolean(id)),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(380px,460px)_minmax(320px,1fr)] lg:overflow-hidden">
        <div className="flex flex-col bg-slate-50 px-4 py-4 lg:overflow-y-auto">
          <div className="sticky top-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-center text-[11px] text-slate-600">
              Tocá un marcador o enfocá un campo para sincronizar la medición.
            </p>
            <MpBermudaGuide
              fields={fields}
              activeMarkerId={activeMarkerId}
              filledMarkerIds={filledMarkerIds}
              onMarkerActivate={onMarkerActivate}
            />
          </div>
        </div>

        <div className="min-h-0 border-t border-slate-200 bg-slate-50 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <MpBermudaFieldStrip
            items={buildMpBermudaFieldStripItems(snapshot)}
            valuesByKey={valuesByKey}
            errorsByKey={errorsByKey}
            activeFieldKey={activeFieldKey}
            onFocus={onFocus}
            onChange={onChange}
          />
        </div>
      </div>

      {footer}
    </div>
  );
}
