"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useState } from "react";

import { type AnatomicalRegion, findRegionSummary, hasDetailView } from "@/lib/body-anatomy";
import { BODY_FIGURE_SEX, type BodyFigureSex } from "@/lib/body-figure-sex";
import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  getFullBodyCalibration,
  type FigureCalibration,
  type FullBodySex,
} from "./body-highlight-calibration";
import { getFemaleZonePath } from "./zones-female";
import { getMaleZonePath } from "./zones-male";
import {
  BODY_CLIP_PATHS,
  BODY_HIGHLIGHT_ARTICULATIONS,
  BODY_HIGHLIGHT_OUTLINES,
  SIDE_LABEL_POSITIONS,
  getFullMarkerForSex,
  getSideSummaryForView,
  getZoneA11yLabel,
  getZoneLabel,
  getZonesForSide,
  type BodyView,
  type IsolatedBodyView,
} from "./body-highlight-zones";
import { DetailRegionPanel } from "./detail-region-panel";
import { SilhouetteDefs } from "./silhouette-defs";
import {
  FullBodyFemale,
  FullBodyMale,
  HAND_DETAIL_VIEWBOX,
  HandDetailFemale,
  HandDetailMale,
  HEAD_DETAIL_VIEWBOX,
  HeadDetailFemale,
  HeadDetailMale,
} from "./silhouettes";
import styles from "./body-highlight.module.css";

export { BODY_FIGURE_SEX, type BodyFigureSex } from "@/lib/body-figure-sex";

// The calibration module's FullBodySex is the same string union; cast is
// only here to bridge the typed-constant alias used at component props.
function toFullBodySex(sex: BodyFigureSex): FullBodySex {
  return sex === BODY_FIGURE_SEX.MALE ? "male" : "female";
}

// Regions that have a dedicated detail asset in this iteration.
// Centralized in body-anatomy.ts via hasDetailView(). The names here just
// declare which keys the BodyHighlight component knows how to render.
export type DetailRegion = Extract<AnatomicalRegion, "head" | "hands">;

// Side selector for regions where laterality matters at the detail level.
// Head detail ignores this; hands use it to crop the asset to just the
// chosen palm/dorso column.
export type DetailSide = "right" | "left";

export type BodyHighlightProps = {
  view: BodyView;
  sex?: BodyFigureSex;
  activeZoneId: AnatomyZoneId | null;
  filledZoneIds?: ReadonlySet<AnatomyZoneId> | ReadonlyArray<AnatomyZoneId>;
  className?: string;
  ariaLabel?: string;
  onZoneClick?: (zoneId: AnatomyZoneId) => void;
  // Fires whenever the detail-view region toggles (hands/head ↔ null) so
  // parents can swap the surrounding measurement strips. For hands, side
  // identifies which palm/dorso column the user opened. Head detail
  // always emits side=null. Internal state still drives rendering; the
  // callback is informative.
  onDetailChange?: (region: DetailRegion | null, side: DetailSide | null) => void;
  // When the surrounding layout already renders the editable field list
  // (measurement shell), suppress the internal read-only catalog panel to
  // avoid showing the same fields twice. Defaults to false so other callers
  // keep the catalog reference.
  hideDetailCatalog?: boolean;
};

function hasFilledZone(
  filledZoneIds: ReadonlySet<AnatomyZoneId> | ReadonlyArray<AnatomyZoneId> | undefined,
  zoneId: AnatomyZoneId,
): boolean {
  if (!filledZoneIds) return false;
  if (Array.isArray(filledZoneIds)) return filledZoneIds.includes(zoneId);
  return (filledZoneIds as ReadonlySet<AnatomyZoneId>).has(zoneId);
}

const DEFAULT_ARIA_LABEL: Record<BodyView, string> = {
  full: "Diagrama corporal completo",
  legs: "Diagrama de piernas",
  arms: "Diagrama de brazos",
};

type TooltipData = {
  zoneId: AnatomyZoneId;
  label: string;
  x: number;
  y: number;
};

function ZoneMarker({
  zone,
  zonePath,
  clipPath,
  isActive,
  isFilled,
  isInteractive,
  defsId,
  onZoneClick,
  onHoverChange,
}: {
  zone: {
    zoneId: AnatomyZoneId;
    side: string;
    point: number;
    view: BodyView;
  };
  zonePath: string;
  clipPath?: string;
  isActive: boolean;
  isFilled: boolean;
  isInteractive: boolean;
  defsId: string;
  onZoneClick?: (zoneId: AnatomyZoneId) => void;
  onHoverChange: (data: TooltipData | null) => void;
}) {
  const fillColor = isActive ? "#0ea5e9" : isFilled ? "#10b981" : "#0f172a";
  const fillOpacity = isActive ? 0.72 : isFilled ? 0.42 : 0;
  const strokeColor = isActive ? "#075985" : isFilled ? "#047857" : "transparent";
  const strokeWidth = isActive ? 1.4 : isFilled ? 1 : 0;
  const activeFilter = isActive ? `url(#${defsId}-zone-glow)` : undefined;

  return (
    <motion.path
      d={zonePath}
      clipPath={clipPath}
      data-zone-id={zone.zoneId}
      data-side={zone.side}
      data-point={zone.point}
      data-active={isActive ? "true" : "false"}
      data-filled={isFilled ? "true" : "false"}
      aria-label={getZoneA11yLabel(zone.zoneId, { active: isActive, filled: isFilled })}
      aria-pressed={isInteractive ? isActive : undefined}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      filter={activeFilter}
      animate={{
        fill: fillColor,
        fillOpacity,
        stroke: strokeColor,
        strokeWidth,
        strokeOpacity: isActive ? 1 : isFilled ? 0.75 : 0,
      }}
      transition={{ fill: { duration: 0.2 }, fillOpacity: { duration: 0.2 } }}
      whileHover={
        isInteractive
          ? { fillOpacity: 0.28, fill: "#0ea5e9", transition: { duration: 0.12 } }
          : undefined
      }
      className={isInteractive ? styles.zone : styles.zoneReadonly}
      onClick={isInteractive ? () => onZoneClick?.(zone.zoneId) : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onZoneClick?.(zone.zoneId);
              }
            }
          : undefined
      }
      onMouseEnter={(event) => {
        const svgEl = (event.currentTarget as SVGElement).closest("svg");
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const evtX = event.clientX - rect.left;
        const evtY = event.clientY - rect.top;
        onHoverChange({
          zoneId: zone.zoneId,
          label: getZoneLabel(zone.zoneId) || zone.zoneId,
          x: evtX,
          y: evtY,
        });
      }}
      onMouseLeave={() => onHoverChange(null)}
    />
  );
}

type RegionHotspotProps = {
  region: DetailRegion;
  side: DetailSide | null;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onActivate: (region: DetailRegion, side: DetailSide | null) => void;
};

function RegionHotspot({ region, side, label, x, y, width, height, onActivate }: RegionHotspotProps) {
  return (
    <g className={styles.regionHotspot}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={10}
        ry={10}
        className={styles.regionHotspotRect}
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalle de ${label}`}
        onClick={() => onActivate(region, side)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate(region, side);
          }
        }}
      />
    </g>
  );
}

type FullBodyLayerProps = {
  sex: BodyFigureSex;
};

function FullBodyLayer({ sex }: FullBodyLayerProps) {
  return sex === "male" ? <FullBodyMale /> : <FullBodyFemale />;
}

type DetailLayerProps = {
  region: DetailRegion;
  sex: BodyFigureSex;
};

function DetailLayer({ region, sex }: DetailLayerProps) {
  if (region === "head") {
    return sex === "male" ? <HeadDetailMale /> : <HeadDetailFemale />;
  }
  return sex === "male" ? <HandDetailMale /> : <HandDetailFemale />;
}

function getViewBoxForState(
  view: BodyView,
  detail: DetailRegion | null,
  detailSide: DetailSide | null,
  fullBodyCalibration: FigureCalibration,
): { x: number; y: number; width: number; height: number } {
  if (view !== "full") {
    return { x: 0, y: 0, width: 240, height: 480 };
  }
  if (detail === "head") {
    // The reference PNG places the three faces in the upper band and leaves
    // the bottom ~40% empty. Cropping to the faces band keeps the figure
    // landscape (uses width) and avoids a tall whitespace letterbox.
    return { x: 0, y: 0, width: HEAD_DETAIL_VIEWBOX.width, height: 820 };
  }
  if (detail === "hands") {
    // Crop to the column matching the selected side. PNG layout:
    //   left column  → subject's right hand (palma D + dorso D)
    //   right column → subject's left hand  (palma I + dorso I)
    // If side is missing (legacy callers, no-side activation), fall back
    // to the full sheet so neither hand goes missing.
    const halfWidth = HAND_DETAIL_VIEWBOX.width / 2;
    if (detailSide === "right") {
      return { x: 0, y: 0, width: halfWidth, height: HAND_DETAIL_VIEWBOX.height };
    }
    if (detailSide === "left") {
      return { x: halfWidth, y: 0, width: halfWidth, height: HAND_DETAIL_VIEWBOX.height };
    }
    return { x: 0, y: 0, width: HAND_DETAIL_VIEWBOX.width, height: HAND_DETAIL_VIEWBOX.height };
  }
  return {
    x: 0,
    y: 0,
    width: fullBodyCalibration.viewBox.width,
    height: fullBodyCalibration.viewBox.height,
  };
}

export function BodyHighlight({
  view,
  sex = BODY_FIGURE_SEX.FEMALE,
  activeZoneId,
  filledZoneIds,
  className,
  ariaLabel,
  onZoneClick,
  onDetailChange,
  hideDetailCatalog = false,
}: BodyHighlightProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [detailRegion, setDetailRegionState] = useState<DetailRegion | null>(null);
  const [detailSide, setDetailSideState] = useState<DetailSide | null>(null);
  const instanceId = useId().replace(/:/g, "");

  const openDetail = (region: DetailRegion, side: DetailSide | null) => {
    setDetailRegionState(region);
    setDetailSideState(side);
    onDetailChange?.(region, side);
  };

  const closeDetail = () => {
    setDetailRegionState(null);
    setDetailSideState(null);
    onDetailChange?.(null, null);
  };

  const isFull = view === "full";
  const isDetail = isFull && detailRegion !== null;
  const isInteractive = Boolean(onZoneClick);

  const fullBodyCalibration = getFullBodyCalibration(toFullBodySex(sex));
  const vb = getViewBoxForState(
    view,
    isDetail ? detailRegion : null,
    isDetail ? detailSide : null,
    fullBodyCalibration,
  );
  const viewBox = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  const defsId = `bh-${view}-${detailRegion ?? "root"}-${detailSide ?? "x"}-${instanceId}`;
  const svgClassName = [styles.svg, className].filter(Boolean).join(" ");
  const summary = detailRegion ? findRegionSummary(detailRegion) : null;
  const detailTitle = (() => {
    if (!summary) return null;
    if (detailRegion === "hands" && detailSide === "right") return "Mano Derecha";
    if (detailRegion === "hands" && detailSide === "left") return "Mano Izquierda";
    return summary.label;
  })();

  // Hand detail renders palm + dorso side by side instead of the single
  // tall column crop. The reference PNG is a clean 2×2 grid: top row =
  // palms, bottom row = dorsa; left column = right hand, right column =
  // left hand. So the chosen side is one vertical half, split 50/50 into
  // palm (top) / dorso (bottom).
  const isHandDetail = isDetail && detailRegion === "hands";
  const handColumnX = detailSide === "left" ? HAND_DETAIL_VIEWBOX.width / 2 : 0;
  const handColumnWidth = HAND_DETAIL_VIEWBOX.width / 2;
  const handRowHeight = HAND_DETAIL_VIEWBOX.height / 2;
  const handCrops = [
    { label: "Palma", y: 0 },
    { label: "Dorso", y: handRowHeight },
  ] as const;
  const wrapperClassName = [styles.wrapper, isDetail ? styles.wrapperDetail : null]
    .filter(Boolean)
    .join(" ");

  const sideSummaries = getSideSummaryForView(view);
  // Full view reads side-label positions from the sex-specific calibration
  // (different figures have different head + side margins). Isolated
  // legs/arms sheets keep their dedicated SIDE_LABEL_POSITIONS entry.
  const sideLabels = isFull
    ? {
        right: {
          x: fullBodyCalibration.sideLabels.right.x,
          y: fullBodyCalibration.sideLabels.right.y,
          label: fullBodyCalibration.sideLabels.right.text,
        },
        left: {
          x: fullBodyCalibration.sideLabels.left.x,
          y: fullBodyCalibration.sideLabels.left.y,
          label: fullBodyCalibration.sideLabels.left.text,
        },
      }
    : SIDE_LABEL_POSITIONS[view];
  // Isolated outlines/articulations live in body-highlight-zones; the
  // full-body silhouette comes from silhouettes/* and never reads from
  // this module.
  const isolatedView: IsolatedBodyView | null = isFull ? null : view;
  const isolatedOutlines = isolatedView ? BODY_HIGHLIGHT_OUTLINES[isolatedView] : null;
  const isolatedArticulations = isolatedView ? BODY_HIGHLIGHT_ARTICULATIONS[isolatedView] : null;

  return (
    <div className={wrapperClassName}>
      {isDetail && summary ? (
        <div className={styles.detailHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={closeDetail}
            aria-label="Volver al cuerpo completo"
          >
            <span aria-hidden="true">←</span> Volver al cuerpo
          </button>
          <div className={styles.detailHeaderText}>
            <p className={styles.detailHeaderKicker}>Detalle anatómico</p>
            <h3 className={styles.detailHeaderTitle}>{detailTitle}</h3>
          </div>
        </div>
      ) : null}

      {isHandDetail ? (
        <div className={styles.handSplit}>
          {handCrops.map(({ label, y }) => (
            <figure key={label} className={styles.handCrop}>
              <svg
                role="img"
                aria-label={`${detailTitle ?? "Mano"} — ${label}`}
                viewBox={`${handColumnX} ${y} ${handColumnWidth} ${handRowHeight}`}
                className={styles.handCropSvg}
                overflow="hidden"
                style={{ overflow: "hidden" }}
              >
                <DetailLayer region="hands" sex={sex} />
              </svg>
              <figcaption className={styles.handCropCaption}>{label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
      <svg
        role="img"
        aria-label={
          isDetail && detailTitle
            ? `Detalle anatómico de ${detailTitle.toLowerCase()}`
            : (ariaLabel ?? DEFAULT_ARIA_LABEL[view])
        }
        viewBox={viewBox}
        className={svgClassName}
        data-view={view}
        data-detail={detailRegion ?? "none"}
        data-detail-side={detailSide ?? "none"}
        data-active-zone={activeZoneId ?? ""}
        // Body view keeps overflow visible so the active-zone glow filter
        // can extend past the SVG bounds. In detail mode the viewBox is
        // intentionally cropped (e.g. half the hands PNG for a single side)
        // so we MUST hide overflow or the rest of the asset leaks in.
        // The inline style is needed because .svg in CSS sets overflow:visible
        // and would otherwise win against the presentation attribute.
        overflow={isDetail ? "hidden" : "visible"}
        style={isDetail ? { overflow: "hidden" } : undefined}
      >
        <title>
          {isDetail && detailTitle
            ? `Detalle anatómico de ${detailTitle}`
            : (ariaLabel ?? DEFAULT_ARIA_LABEL[view])}
        </title>
        <desc>
          {isDetail && detailTitle
            ? `Referencia clínica para ${detailTitle}. Los campos asociados se listan debajo del gráfico.`
            : sideSummaries.map((s) => `${s.label}: ${s.points} puntos`).join(". ")}
        </desc>

        <SilhouetteDefs id={defsId} />

        {/* DETAIL VIEW — dedicated head or hand asset only */}
        {isDetail && detailRegion ? <DetailLayer region={detailRegion} sex={sex} /> : null}

        {/* FULL or ISOLATED VIEW */}
        {!isDetail ? (
          <>
            {/* Figure underneath: traced silhouette (full) or hand-drawn isolated outline */}
            {isFull ? (
              <FullBodyLayer sex={sex} />
            ) : isolatedOutlines && isolatedArticulations ? (
              <>
                <g>
                  {isolatedOutlines.map((d, index) => (
                    <path
                      key={`outline-fill-${index}`}
                      d={d}
                      fill="white"
                      fillRule="evenodd"
                      stroke="none"
                    />
                  ))}
                </g>
                <g>
                  {isolatedOutlines.map((d, index) => (
                    <path
                      key={`outline-${index}`}
                      d={d}
                      fill="none"
                      fillRule="evenodd"
                      stroke="#1f2937"
                      strokeWidth={1.4}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
                <g
                  aria-hidden="true"
                  fill="none"
                  stroke="#64748b"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                >
                  {isolatedArticulations.map((d, index) => (
                    <path key={`articulation-${index}`} d={d} />
                  ))}
                </g>
              </>
            ) : null}

            {/* Clip paths only needed for isolated views (per-limb rect). */}
            {isolatedView ? (
              <defs>
                <clipPath id={`${defsId}-right`}>
                  <path d={BODY_CLIP_PATHS[isolatedView].right} />
                </clipPath>
                <clipPath id={`${defsId}-left`}>
                  <path d={BODY_CLIP_PATHS[isolatedView].left} />
                </clipPath>
              </defs>
            ) : null}

            {/* Zone markers (bounded rects). Full-body markers are
                positioned via the sex-specific calibration so they always
                stay inside the limb; isolated views keep their column
                clip. */}
            <g>
              {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
                const zones = getZonesForSide(view, side);
                return (
                  <g key={`zones-${side}`}>
                    {zones.map((zone) => {
                      const isActive = zone.zoneId === activeZoneId;
                      const isFilled = hasFilledZone(filledZoneIds, zone.zoneId);
                      // Full-body uses the auto-generated anatomical zone
                      // polygon (entire limb section fills) for each sex.
                      // Any zone missing from the per-sex map falls back to
                      // a bounded marker so the figure keeps rendering.
                      const zonedFullPath = isFull
                        ? sex === BODY_FIGURE_SEX.MALE
                          ? getMaleZonePath(zone.zoneId)
                          : getFemaleZonePath(zone.zoneId)
                        : undefined;
                      const zonePath = isFull
                        ? (zonedFullPath ?? getFullMarkerForSex(fullBodyCalibration, zone).path)
                        : zone.d;
                      const clipPath = isFull ? undefined : `url(#${defsId}-${side})`;
                      return (
                        <ZoneMarker
                          key={zone.zoneId}
                          zone={zone}
                          zonePath={zonePath}
                          clipPath={clipPath}
                          isActive={isActive}
                          isFilled={isFilled}
                          isInteractive={isInteractive}
                          defsId={defsId}
                          onZoneClick={onZoneClick}
                          onHoverChange={setTooltip}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* Side labels (D / I) */}
            <g className={styles.sideLabels} aria-hidden="true">
              {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
                const sl = sideLabels[side];
                const summarySide = sideSummaries.find((s) => s.side === side);
                return (
                  <text
                    key={side}
                    x={sl.x}
                    y={sl.y}
                    data-active={
                      summarySide && summarySide.side === activeZoneId?.split(".")[1]
                        ? "true"
                        : "false"
                    }
                  >
                    {sl.label}
                  </text>
                );
              })}
            </g>

            {/* Active point number — small, sits inside the active marker.
                In full view we read the center from the sex-specific
                calibration to stay aligned with the rendered marker. */}
            <g className={styles.pointLabels} aria-hidden="true">
              {activeZoneId
                ? getZonesForSide(view, "right")
                    .concat(getZonesForSide(view, "left"))
                    .filter((zone) => zone.zoneId === activeZoneId)
                    .map((zone) => {
                      const center = isFull
                        ? getFullMarkerForSex(fullBodyCalibration, zone)
                        : { centerX: zone.labelX, centerY: zone.labelY };
                      return (
                        <text
                          key={`label-${zone.zoneId}`}
                          x={center.centerX}
                          y={center.centerY + 3}
                          data-active="true"
                        >
                          {zone.point}
                        </text>
                      );
                    })
                : null}
            </g>

            {/* Region hotspots — head + hands trigger detail view (full only).
                Coordinates come from the sex-specific calibration. */}
            {isFull && isInteractive && hasDetailView("head") ? (
              <RegionHotspot
                region="head"
                side={null}
                label="cabeza"
                x={fullBodyCalibration.headHotspot.x}
                y={fullBodyCalibration.headHotspot.y}
                width={fullBodyCalibration.headHotspot.width}
                height={fullBodyCalibration.headHotspot.height}
                onActivate={openDetail}
              />
            ) : null}
            {isFull && isInteractive && hasDetailView("hands")
              ? fullBodyCalibration.handHotspots.map((hotspot) => (
                  <RegionHotspot
                    key={`hand-${hotspot.side}`}
                    region="hands"
                    side={hotspot.side}
                    label={`mano ${hotspot.side === "right" ? "derecha" : "izquierda"}`}
                    x={hotspot.x}
                    y={hotspot.y}
                    width={hotspot.width}
                    height={hotspot.height}
                    onActivate={openDetail}
                  />
                ))
              : null}
          </>
        ) : null}
      </svg>
      )}

      {/* Floating tooltip — only for measurement zones in full/iso views */}
      <AnimatePresence>
        {tooltip && !isDetail ? (
          <motion.div
            key={tooltip.zoneId}
            className={styles.tooltip}
            style={{ left: tooltip.x, top: tooltip.y }}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
          >
            <span className={styles.tooltipLabel}>{tooltip.label}</span>
            {hasFilledZone(filledZoneIds, tooltip.zoneId) ? (
              <span className={styles.tooltipBadge}>Medido</span>
            ) : null}
            {tooltip.zoneId === activeZoneId ? (
              <span className={styles.tooltipBadgeActive}>Activo</span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Pending-fields panel for detail mode */}
      {isDetail && detailRegion && !hideDetailCatalog ? (
        <DetailRegionPanel region={detailRegion} side={detailSide} />
      ) : null}
    </div>
  );
}
