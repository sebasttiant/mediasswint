"use client";

import { useState, useCallback } from "react";
import type { ReactNode } from "react";

import { BodyHighlight, type BodyFigureSex } from "@/app/_components/body-highlight/body-highlight";
import { FaceGuide } from "@/app/_components/body-highlight/face-guide";
import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  buildMeasurementTableRows,
  getFilledZoneIdsFromValues,
  measurementSnapshotRequiresFaceGuide,
  type MeasurementUiField,
} from "../../measurements-ui";
import { ZoneStrip } from "./zone-strip";
import { MobileStripTabs, MobileStripPanel, type StripTabId } from "./mobile-strip-tabs";

import type { TemplateSnapshot } from "@/lib/measurements";

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

  const filledZoneIds = getFilledZoneIdsFromValues(templateSnapshot, valuesByKey);
  const shouldRenderFaceGuide = measurementSnapshotRequiresFaceGuide(templateSnapshot);

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

  const handleFocus = useCallback((zoneId: string) => {
    setActiveZoneId(zoneId as AnatomyZoneId);
  }, []);

  const handleZoneClick = useCallback((zoneId: AnatomyZoneId) => {
    setActiveZoneId(zoneId);
    const input = document.querySelector<HTMLElement>(`[data-anatomy-zone="${zoneId}"]`);
    input?.focus();
  }, []);

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
      <div className="lg:hidden flex justify-center py-4 bg-slate-50 border-b border-slate-200">
        <div className="w-48">
          <BodyHighlight
            view="full"
            sex={sex}
            activeZoneId={activeZoneId}
            filledZoneIds={filledZoneIds}
            ariaLabel={`Figura humana ${sex === "male" ? "masculina" : "femenina"} con zonas activas`}
            onZoneClick={handleZoneClick}
          />
          {shouldRenderFaceGuide ? <FaceGuide sex={sex} /> : null}
        </div>
      </div>

      {/* Mobile active strip */}
      <MobileStripPanel activeTab={mobileTab}>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100dvh - 280px)" }}>
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

      {/* Desktop 3-column grid */}
      <div className="hidden lg:grid lg:grid-cols-[220px_1fr_220px] flex-1 min-h-0 overflow-hidden">
        {/* Left panel: right side limbs (anatomically mirrored labeling on paper) */}
        <div className="flex flex-col border-r border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto border-b border-slate-100">
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
          <div className="flex-1 overflow-y-auto">
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
        </div>

        {/* Center: body figure sticky */}
        <div className="flex flex-col items-center justify-start gap-4 overflow-y-auto bg-slate-50 px-4 py-6">
          <div className="sticky top-4 flex flex-col items-center gap-4 w-full">
            <div className="w-full max-w-[200px]">
              <BodyHighlight
                view="full"
                sex={sex}
                activeZoneId={activeZoneId}
                filledZoneIds={filledZoneIds}
                ariaLabel={`Figura humana ${sex === "male" ? "masculina" : "femenina"} con zonas activas`}
                onZoneClick={handleZoneClick}
              />
            </div>
            {shouldRenderFaceGuide ? (
              <div className="w-full max-w-[180px]">
                <FaceGuide sex={sex} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Right panel: left side limbs */}
        <div className="flex flex-col border-l border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto border-b border-slate-100">
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
          <div className="flex-1 overflow-y-auto">
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
        </div>
      </div>

      {footer}
    </div>
  );
}
