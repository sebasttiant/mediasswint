"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  BodyHighlight,
  type BodyFigureSex,
  type DetailRegion,
  type DetailSide,
} from "@/app/_components/body-highlight/body-highlight";
import { FaceGuide } from "@/app/_components/body-highlight/face-guide";
import {
  getPendingFieldsForRegion,
  type PdfMeasurementField,
} from "@/lib/body-anatomy";
import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  buildMeasurementTableRows,
  getFilledZoneIdsFromValues,
  measurementSnapshotRequiresFaceGuide,
  type MeasurementUiField,
} from "../../measurements-ui";
import { DetailFieldStrip } from "./detail-field-strip";
import { ZoneStrip } from "./zone-strip";
import { MobileStripTabs, MobileStripPanel, type StripTabId } from "./mobile-strip-tabs";

import type { TemplateSnapshot } from "@/lib/measurements";

type DetailStrips = {
  right: { title: string; fields: ReadonlyArray<PdfMeasurementField> } | null;
  left: { title: string; fields: ReadonlyArray<PdfMeasurementField> } | null;
  // Solo se usa cuando los campos no tienen side (head, neck): muestra una
  // única columna centrada.
  center: { title: string; fields: ReadonlyArray<PdfMeasurementField> } | null;
};

function buildDetailStrips(region: DetailRegion, side: DetailSide | null): DetailStrips {
  const fields = getPendingFieldsForRegion(region);

  if (region === "hands") {
    // When a side is selected (mano derecha / mano izquierda) only show
    // the matching column. If no side reaches the shell (legacy entry
    // point), fall back to both so neither hand goes missing.
    if (side === "right") {
      return {
        right: {
          title: "Mano Derecha",
          fields: fields.filter((f) => f.side === "right" || f.side === "bilateral"),
        },
        left: null,
        center: null,
      };
    }
    if (side === "left") {
      return {
        right: null,
        left: {
          title: "Mano Izquierda",
          fields: fields.filter((f) => f.side === "left" || f.side === "bilateral"),
        },
        center: null,
      };
    }
    return {
      right: {
        title: "Mano Derecha",
        fields: fields.filter((f) => f.side === "right" || f.side === "bilateral"),
      },
      left: {
        title: "Mano Izquierda",
        fields: fields.filter((f) => f.side === "left" || f.side === "bilateral"),
      },
      center: null,
    };
  }

  // head — los campos no tienen lateralidad; los mostramos en una sola columna.
  return {
    right: null,
    left: null,
    center: { title: "Cabeza", fields },
  };
}

type MeasurementShellProps = {
  templateSnapshot: TemplateSnapshot;
  valuesByKey: Record<string, string>;
  sex: BodyFigureSex;
  footer: ReactNode;
  onValueChange: (key: string, value: string) => void;
};

export function MeasurementShell({
  templateSnapshot,
  valuesByKey,
  sex,
  footer,
  onValueChange,
}: MeasurementShellProps) {
  const [activeZoneId, setActiveZoneId] = useState<AnatomyZoneId | null>(null);
  const [mobileTab, setMobileTab] = useState<StripTabId>("RL");
  const [detailRegion, setDetailRegion] = useState<DetailRegion | null>(null);
  const [detailSide, setDetailSide] = useState<DetailSide | null>(null);
  // Borrador local de campos mano/cabeza — no se persiste todavía.
  // Cuando el contrato de datos esté cerrado, se migra a valuesByKey.
  const [draftByKey, setDraftByKey] = useState<Record<string, string>>({});

  const detailStrips = useMemo(
    () => (detailRegion ? buildDetailStrips(detailRegion, detailSide) : null),
    [detailRegion, detailSide],
  );

  const handleDetailChange = (region: DetailRegion | null, side: DetailSide | null) => {
    setDetailRegion(region);
    setDetailSide(side);
  };

  const filledZoneIds = getFilledZoneIdsFromValues(templateSnapshot, valuesByKey);
  const shouldRenderFaceGuide = measurementSnapshotRequiresFaceGuide(templateSnapshot);

  function handleDraftChange(key: string, value: string) {
    setDraftByKey((prev) => ({ ...prev, [key]: value }));
  }

  const legRows = buildMeasurementTableRows(templateSnapshot, "legs", {});
  const armRows = buildMeasurementTableRows(templateSnapshot, "arms", {});

  const rightLegFields: MeasurementUiField[] = legRows
    .map((r) => r.right)
    .filter((f): f is MeasurementUiField => f !== null);

  const leftLegFields: MeasurementUiField[] = legRows
    .map((r) => r.left)
    .filter((f): f is MeasurementUiField => f !== null);

  const rightArmFields: MeasurementUiField[] = armRows
    .map((r) => r.right)
    .filter((f): f is MeasurementUiField => f !== null);

  const leftArmFields: MeasurementUiField[] = armRows
    .map((r) => r.left)
    .filter((f): f is MeasurementUiField => f !== null);

  function handleFocus(zoneId: string) {
    setActiveZoneId(zoneId as AnatomyZoneId);
  }

  function handleZoneClick(zoneId: AnatomyZoneId) {
    setActiveZoneId(zoneId);
    const input = document.querySelector<HTMLElement>(`[data-anatomy-zone="${zoneId}"]`);
    input?.focus();
  }

  const activeTabFields: MeasurementUiField[] = {
    RL: rightLegFields,
    LL: leftLegFields,
    RA: rightArmFields,
    LA: leftArmFields,
  }[mobileTab];

  const activeTabLimb: "leg" | "arm" = mobileTab.endsWith("L") ? "leg" : "arm";
  const activeTabSide: "right" | "left" = mobileTab.startsWith("R") ? "right" : "left";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile tabs */}
      <MobileStripTabs activeTab={mobileTab} onTabChange={setMobileTab} />

      {/* Mobile body figure */}
      <div className="lg:hidden border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapa corporal interactivo</p>
            <p className="mt-1 text-xs text-slate-600">Tocá una zona para abrir su campo de medida.</p>
          </div>
          <div className="w-full max-w-[170px] sm:max-w-[200px] md:max-w-[220px]">
            <BodyHighlight
              view="full"
              sex={sex}
              activeZoneId={activeZoneId}
              filledZoneIds={filledZoneIds}
              ariaLabel={`Figura humana ${sex === "male" ? "masculina" : "femenina"} con zonas activas`}
              onZoneClick={handleZoneClick}
              onDetailChange={handleDetailChange}
              hideDetailCatalog
            />
          </div>
          {shouldRenderFaceGuide ? <FaceGuide sex={sex} /> : null}
        </div>
      </div>

      {/* Mobile active strip — body view shows the leg/arm tab; in detail
          view we replace the strip with the region's pending PDF fields. */}
      {detailRegion && detailStrips ? (
        <div className="lg:hidden border-t border-slate-200">
          {detailStrips.center ? (
            <DetailFieldStrip
              title={detailStrips.center.title}
              fields={detailStrips.center.fields}
              draftByKey={draftByKey}
              onDraftChange={handleDraftChange}
              tone="neutral"
            />
          ) : (
            (() => {
              const sided = [detailStrips.right, detailStrips.left].filter(
                (s): s is NonNullable<typeof s> => s !== null,
              );
              const onlyOne = sided.length === 1;
              return (
                <div
                  className={
                    onlyOne
                      ? "lg:h-full"
                      : "grid grid-cols-2 divide-x divide-slate-200 lg:h-full"
                  }
                >
                  {detailStrips.right ? (
                    <DetailFieldStrip
                      title={detailStrips.right.title}
                      fields={detailStrips.right.fields}
                      draftByKey={draftByKey}
                      onDraftChange={handleDraftChange}
                      tone="right"
                    />
                  ) : null}
                  {detailStrips.left ? (
                    <DetailFieldStrip
                      title={detailStrips.left.title}
                      fields={detailStrips.left.fields}
                      draftByKey={draftByKey}
                      onDraftChange={handleDraftChange}
                      tone="left"
                    />
                  ) : null}
                </div>
              );
            })()
          )}
        </div>
      ) : (
        <MobileStripPanel activeTab={mobileTab}>
          <div>
            <ZoneStrip
              side={activeTabSide}
              limb={activeTabLimb}
              fields={activeTabFields}
              valuesByKey={valuesByKey}
              activeZoneId={activeZoneId}
              onFocus={handleFocus}
              onChange={onValueChange}
            />
          </div>
        </MobileStripPanel>
      )}

      {/* Desktop layout.
          Body view → 3 columns: right-side limbs | figure | left-side limbs.
          Detail view → 2 zones: comfortable field panel | wide figure.
          The figure column (cellB) keeps the SAME position in both modes so
          BodyHighlight never unmounts and its detail state survives the
          body↔detail transition. */}
      <div
        className={`hidden flex-1 min-h-0 overflow-hidden lg:grid ${
          detailRegion
            ? "lg:grid-cols-[minmax(340px,0.5fr)_minmax(0,1.5fr)]"
            : "lg:grid-cols-[minmax(280px,1fr)_minmax(380px,460px)_minmax(280px,1fr)]"
        }`}
      >
        {/* Cell A — detail: active region fields. body: right-side limbs. */}
        <div className="flex flex-col overflow-hidden border-r border-slate-200">
          {detailRegion && detailStrips ? (
            (() => {
              const active =
                detailStrips.center ?? detailStrips.right ?? detailStrips.left;
              const tone = detailStrips.center
                ? "neutral"
                : detailStrips.right
                  ? "right"
                  : "left";
              return active ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                  <DetailFieldStrip
                    title={active.title}
                    fields={active.fields}
                    draftByKey={draftByKey}
                    onDraftChange={handleDraftChange}
                    tone={tone}
                  />
                </div>
              ) : null;
            })()
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-hidden border-b border-slate-100">
                <ZoneStrip
                  side="right"
                  limb="arm"
                  fields={rightArmFields}
                  valuesByKey={valuesByKey}
                  activeZoneId={activeZoneId}
                  onFocus={handleFocus}
                  onChange={onValueChange}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ZoneStrip
                  side="right"
                  limb="leg"
                  fields={rightLegFields}
                  valuesByKey={valuesByKey}
                  activeZoneId={activeZoneId}
                  onFocus={handleFocus}
                  onChange={onValueChange}
                />
              </div>
            </>
          )}
        </div>

        {/* Cell B — body figure. Always mounted here. */}
        <div className="flex flex-col items-stretch justify-start overflow-y-auto bg-slate-50 px-4 py-4">
          <div className="sticky top-3 flex flex-col items-stretch gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {!detailRegion ? (
              <>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mapa corporal interactivo</p>
                  <p className="mt-1 text-[11px] text-slate-600">Tocá una zona o enfocá un campo para sincronizar la medición.</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-medium text-slate-600" aria-label="Leyenda de estados de medición">
                  <div className="rounded-md border border-sky-100 bg-sky-50 px-2 py-1.5 text-center text-sky-700">
                    <span className="mx-auto mb-0.5 block size-1.5 rounded-full bg-sky-500" />
                    Activa
                  </div>
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-center text-emerald-700">
                    <span className="mx-auto mb-0.5 block size-1.5 rounded-full bg-emerald-500" />
                    Medida
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-center text-slate-500">
                    <span className="mx-auto mb-0.5 block size-1.5 rounded-full bg-slate-300" />
                    Pendiente
                  </div>
                </div>
              </>
            ) : null}

            <div className={detailRegion ? "w-full" : "mx-auto w-full max-w-[360px]"}>
              <BodyHighlight
                view="full"
                sex={sex}
                activeZoneId={activeZoneId}
                filledZoneIds={filledZoneIds}
                ariaLabel={`Figura humana ${sex === "male" ? "masculina" : "femenina"} con zonas activas`}
                onZoneClick={handleZoneClick}
                onDetailChange={handleDetailChange}
                hideDetailCatalog
              />
            </div>

            {!detailRegion && shouldRenderFaceGuide ? (
              <div className="mx-auto w-full max-w-[180px]">
                <FaceGuide sex={sex} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Cell C — body: left-side limbs. Hidden in detail (2-zone layout). */}
        <div
          className={`flex-col overflow-hidden border-l border-slate-200 ${
            detailRegion ? "hidden" : "flex"
          }`}
        >
          <div className="min-h-0 flex-1 overflow-hidden border-b border-slate-100">
            <ZoneStrip
              side="left"
              limb="arm"
              fields={leftArmFields}
              valuesByKey={valuesByKey}
              activeZoneId={activeZoneId}
              onFocus={handleFocus}
              onChange={onValueChange}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <ZoneStrip
              side="left"
              limb="leg"
              fields={leftLegFields}
              valuesByKey={valuesByKey}
              activeZoneId={activeZoneId}
              onFocus={handleFocus}
              onChange={onValueChange}
            />
          </div>
        </div>
      </div>

      {footer}
    </div>
  );
}
