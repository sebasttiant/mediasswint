"use client";

import { useRef, type ReactNode } from "react";

import { BodyHighlight, type BodyFigureSex } from "@/app/_components/body-highlight/body-highlight";
import type { AnatomyZoneId } from "@/lib/compression-measurements";
import {
  buildHeadFigureAriaLabel,
  type HeadViewComposition,
} from "@/lib/head-measurement-layout";

import type { MeasurementUiField } from "../../measurements-ui";
import { HeadMeasurementFieldStrip } from "./head-measurement-field-strip";
import {
  focusVisibleZoneInput,
  HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS,
  HEAD_MEASUREMENT_DESKTOP_FIGURE_PANEL_CLASS,
  HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS,
  HEAD_MEASUREMENT_MOBILE_FIGURE_CLASS,
} from "./head-measurement-shell-contract";

type HeadMeasurementShellLayoutProps = {
  /** Declares garment label, panels, crop and figure width cap. */
  composition: HeadViewComposition;
  /** Keys actually painted — narrowed by the caller for degraded snapshots. */
  visibleHeadZoneKeys: ReadonlyArray<string>;
  sex: BodyFigureSex;
  activeZoneId: AnatomyZoneId | null;
  filledZoneIds: ReadonlySet<AnatomyZoneId>;
  fields: MeasurementUiField[];
  valuesByKey: Record<string, string>;
  onFocus: (zoneId: string) => void;
  onChange: (key: string, value: string) => void;
  // Same handler measurement-shell.tsx uses for the compression figure:
  // sets activeZoneId AND focuses the matching [data-anatomy-zone] input.
  onZoneClick: (zoneId: AnatomyZoneId) => void;
  /** Non-null when the snapshot is degraded/empty; rendered as a banner. */
  warning?: string | null;
  footer: ReactNode;
};

// Shared layout for every head garment (Mentonera, Máscara). The head figure
// has no laterality (no D/I columns), so it does not reuse the compression
// 3-column right-limbs/figure/left-limbs grid. Mirrors that grid's spirit
// (fields beside the figure, figure never unmounts) with a single field column
// instead of two. The compression legs/arms layout in measurement-shell.tsx is
// a completely separate return branch and is never touched by this file.
export function HeadMeasurementShellLayout({
  composition,
  visibleHeadZoneKeys,
  sex,
  activeZoneId,
  filledZoneIds,
  fields,
  valuesByKey,
  onFocus,
  onChange,
  onZoneClick,
  warning = null,
  footer,
}: HeadMeasurementShellLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const title = composition.garmentLabel;
  const ariaLabel = buildHeadFigureAriaLabel(composition);
  const hasFields = fields.length > 0;

  function handleZoneClick(zoneId: AnatomyZoneId) {
    onZoneClick(zoneId);
    if (layoutRef.current) focusVisibleZoneInput(layoutRef.current, zoneId);
  }

  const figure = (
    <BodyHighlight
      view="head"
      sex={sex}
      activeZoneId={activeZoneId}
      filledZoneIds={filledZoneIds}
      ariaLabel={ariaLabel}
      onZoneClick={handleZoneClick}
      hideDetailCatalog
      headComposition={composition}
      visibleHeadZoneKeys={visibleHeadZoneKeys}
    />
  );

  return (
    <div ref={layoutRef} className="flex flex-col flex-1 min-h-0">
      {warning ? (
        <div
          role="alert"
          data-head-layout-warning="true"
          className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 sm:text-sm"
        >
          {warning}
        </div>
      ) : null}

      {/* Mobile: figure on top, fields below in the page scroll. */}
      <div className={HEAD_MEASUREMENT_MOBILE_FIGURE_CLASS}>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-1 text-xs text-slate-600">
              Tocá una zona o enfocá un campo para sincronizar la medición.
            </p>
          </div>
          <div className="w-full max-w-[220px] sm:max-w-[260px]">{figure}</div>
        </div>
      </div>

      <div className="lg:hidden border-t border-slate-200">
        {hasFields ? (
          <HeadMeasurementFieldStrip
            fields={fields}
            title={title}
            valuesByKey={valuesByKey}
            activeZoneId={activeZoneId}
            onFocus={onFocus}
            onChange={onChange}
          />
        ) : (
          <HeadMeasurementEmptyState garmentLabel={title} />
        )}
      </div>

      {/* Desktop: keep the compact field column beside a wide clinical figure. */}
      <div className={HEAD_MEASUREMENT_DESKTOP_LAYOUT_CLASS}>
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          {hasFields ? (
            <HeadMeasurementFieldStrip
              title={title}
              fields={fields}
              valuesByKey={valuesByKey}
              activeZoneId={activeZoneId}
              onFocus={onFocus}
              onChange={onChange}
            />
          ) : (
            <HeadMeasurementEmptyState garmentLabel={title} />
          )}
        </div>

        <div className={HEAD_MEASUREMENT_DESKTOP_FIGURE_PANEL_CLASS}>
          <div className={HEAD_MEASUREMENT_DESKTOP_FIGURE_CARD_CLASS}>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {title}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Tocá una zona o enfocá un campo para sincronizar la medición.
              </p>
            </div>

            {/* Width cap comes from the composition so a narrower crop
                (Máscara, front-only) cannot letterbox into a figure taller
                than the footer-safe height. */}
            <div
              className="mx-auto w-full"
              style={{ maxWidth: `${composition.maxWidthPx}px` }}
              data-head-figure-max-width={String(composition.maxWidthPx)}
            >
              {figure}
            </div>
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}

// A head session whose snapshot carries no usable field must never render as a
// silently blank form — the operator needs to know why there is nothing to fill.
function HeadMeasurementEmptyState({ garmentLabel }: { garmentLabel: string }) {
  return (
    <div
      data-head-layout-empty="true"
      className="flex flex-col items-center gap-1 px-4 py-8 text-center"
    >
      <p className="text-sm font-semibold text-slate-700">
        No hay medidas disponibles para {garmentLabel}
      </p>
      <p className="text-xs text-slate-500">
        La plantilla de esta sesión no contiene campos de cabeza utilizables. Regenerá la plantilla
        antes de continuar.
      </p>
    </div>
  );
}
