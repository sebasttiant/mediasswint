"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  BODY_FIGURE_CLIP_PATHS,
  BODY_FIGURE_OUTLINES,
  BODY_CLIP_PATHS,
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  SIDE_LABEL_POSITIONS,
  getSideSummaryForView,
  getZoneA11yLabel,
  getZoneLabel,
  getZonesForSide,
  type BodyView,
} from "./body-highlight-zones";
import { SilhouetteDefs } from "./silhouette-defs";
import styles from "./body-highlight.module.css";

export const BODY_FIGURE_SEX = {
  FEMALE: "female",
  MALE: "male",
} as const;

export type BodyFigureSex = (typeof BODY_FIGURE_SEX)[keyof typeof BODY_FIGURE_SEX];

export type BodyHighlightProps = {
  view: BodyView;
  sex?: BodyFigureSex;
  activeZoneId: AnatomyZoneId | null;
  filledZoneIds?: ReadonlySet<AnatomyZoneId> | ReadonlyArray<AnatomyZoneId>;
  className?: string;
  ariaLabel?: string;
  onZoneClick?: (zoneId: AnatomyZoneId) => void;
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

// viewBox config per view: full uses the 240×720 canvas, isolated views use 240×480
const VIEW_BOX_CONFIG: Record<BodyView, { x: number; y: number; width: number; height: number }> = {
  full: { x: 0, y: 0, width: BODY_HIGHLIGHT_VIEWBOX.width, height: BODY_HIGHLIGHT_VIEWBOX.height },
  legs: { x: 0, y: 0, width: 240, height: 480 },
  arms: { x: 0, y: 0, width: 240, height: 480 },
};

type TooltipData = {
  zoneId: AnatomyZoneId;
  label: string;
  x: number;
  y: number;
};

function ZonePath({
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
  zone: { zoneId: AnatomyZoneId; side: string; point: number; view: BodyView; labelX: number; labelY: number; fullLabelX: number; fullLabelY: number };
  zonePath: string;
  clipPath: string;
  isActive: boolean;
  isFilled: boolean;
  isInteractive: boolean;
  defsId: string;
  onZoneClick?: (zoneId: AnatomyZoneId) => void;
  onHoverChange: (data: TooltipData | null) => void;
}) {
  const fillColor = isActive
    ? "#0284c7"
    : isFilled
      ? "#10b981"
      : "#e2e8f0";

  const fillOpacity = isActive ? 0.72 : isFilled ? 0.44 : 0.08;

  const strokeColor = isActive ? "#0c4a6e" : isFilled ? "#065f46" : "#cbd5e1";
  const strokeWidth = isActive ? 1.5 : isFilled ? 1 : 0.35;

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
        strokeOpacity: isActive ? 1 : isFilled ? 0.78 : 0.38,
        scale: isActive ? [1, 1.04, 1] : 1,
      }}
      transition={
        isActive
          ? { scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }, fill: { duration: 0.3 }, fillOpacity: { duration: 0.3 } }
          : { fill: { duration: 0.3 }, fillOpacity: { duration: 0.3 } }
      }
      whileHover={
        isInteractive
          ? { fillOpacity: 0.45, fill: "#0ea5e9", scale: 1.02, transition: { duration: 0.15 } }
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
        onHoverChange({ zoneId: zone.zoneId, label: getZoneLabel(zone.zoneId) || zone.zoneId, x: evtX, y: evtY });
      }}
      onMouseLeave={() => onHoverChange(null)}
    />
  );
}

export function BodyHighlight({
  view,
  sex = BODY_FIGURE_SEX.FEMALE,
  activeZoneId,
  filledZoneIds,
  className,
  ariaLabel,
  onZoneClick,
}: BodyHighlightProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const outlines = view === "full" ? BODY_FIGURE_OUTLINES[sex] : BODY_HIGHLIGHT_OUTLINES[view];
  const sideSummaries = getSideSummaryForView(view);
  const svgClassName = [styles.svg, className].filter(Boolean).join(" ");
  const isInteractive = Boolean(onZoneClick);
  const sideLabels = SIDE_LABEL_POSITIONS[view];
  const vb = VIEW_BOX_CONFIG[view];
  const viewBox = `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  const defsId = `bh-${view}`;

  return (
    <div className={styles.wrapper}>
      <svg
        role="img"
        aria-label={ariaLabel ?? DEFAULT_ARIA_LABEL[view]}
        viewBox={viewBox}
        className={svgClassName}
        data-view={view}
        data-active-zone={activeZoneId ?? ""}
        overflow="visible"
      >
        <title>{ariaLabel ?? DEFAULT_ARIA_LABEL[view]}</title>
        <desc>
          {sideSummaries
            .map((summary) => `${summary.label}: ${summary.points} puntos`)
            .join(". ")}
        </desc>

        <SilhouetteDefs id={defsId} />

        <defs>
          <clipPath id={`clip-${view}-right`}>
            <path d={BODY_CLIP_PATHS[view].right} />
          </clipPath>
          <clipPath id={`clip-${view}-left`}>
            <path d={BODY_CLIP_PATHS[view].left} />
          </clipPath>
          {view === "full" ? (
            <>
              <clipPath id={`clip-full-${sex}-legs-right`}>
                <path d={BODY_FIGURE_CLIP_PATHS[sex].legs.right} />
              </clipPath>
              <clipPath id={`clip-full-${sex}-legs-left`}>
                <path d={BODY_FIGURE_CLIP_PATHS[sex].legs.left} />
              </clipPath>
              <clipPath id={`clip-full-${sex}-arms-right`}>
                <path d={BODY_FIGURE_CLIP_PATHS[sex].arms.right} />
              </clipPath>
              <clipPath id={`clip-full-${sex}-arms-left`}>
                <path d={BODY_FIGURE_CLIP_PATHS[sex].arms.left} />
              </clipPath>
            </>
          ) : null}
        </defs>

        {/* Silhouette fill */}
        <g>
          {outlines.map((d, index) => (
            <path
              key={`fill-${index}`}
              d={d}
              fill="#fbfcfe"
              stroke="none"
            />
          ))}
        </g>

        {/* Silhouette contour — single clean stroke, no internal decorations */}
        <g>
          {outlines.map((d, index) => (
            <path
              key={`outline-${index}`}
              d={d}
              fill="none"
              stroke="#1f2937"
              strokeWidth={1.2}
              strokeOpacity={0.9}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* Clinical body-map guide lines — segment references like the paper form */}
        {view === "full" ? (
          <g
            aria-hidden="true"
            fill="none"
            stroke="#1f2937"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.72}
            strokeWidth={0.85}
            vectorEffect="non-scaling-stroke"
          >
            {/* Neck and shoulder references */}
            <path d="M 92 52 Q 86 60, 91 72 M 148 52 Q 154 60, 149 72" />
            <path d="M 108 122 Q 120 126, 132 122" />
            <path d="M 78 156 Q 98 164, 120 164 Q 142 164, 162 156" />

            {/* Torso measurement bands */}
            <path d="M 78 220 Q 120 226, 162 220" />
            <path d="M 88 288 Q 120 294, 152 288" />
            <path d="M 82 370 Q 120 386, 158 370" />

            {/* Arm articulation references */}
            <path d="M 34 278 Q 52 284, 70 278 M 170 278 Q 188 284, 206 278" />
            <path d="M 38 424 Q 54 430, 70 424 M 170 424 Q 186 430, 202 424" />
            <path d="M 52 490 L 52 510 M 58 492 L 58 512 M 64 490 L 64 508" />
            <path d="M 176 490 L 176 508 M 182 492 L 182 512 M 188 490 L 188 510" />

            {/* Leg articulation references */}
            <path d="M 82 556 Q 101 564, 120 556 M 120 556 Q 139 564, 158 556" />
            <path d="M 86 640 Q 102 646, 118 640 M 122 640 Q 138 646, 154 640" />
            <path d="M 88 716 Q 102 720, 116 716 M 124 716 Q 138 720, 152 716" />
          </g>
        ) : null}

        {/* Side labels */}
        <g className={styles.sideLabels} aria-hidden="true">
          {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
            const sl = sideLabels[side];
            const summary = sideSummaries.find((s) => s.side === side);
            return (
              <text
                key={side}
                x={sl.x}
                y={view === "full" ? 20 : 16}
                data-active={
                  summary && summary.side === activeZoneId?.split(".")[1] ? "true" : "false"
                }
              >
                {sl.label}
              </text>
            );
          })}
        </g>

        {/* Zone overlays */}
        {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
          const zones = getZonesForSide(view, side);
          return (
            <g key={side}>
              {zones.map((zone) => {
                const isActive = zone.zoneId === activeZoneId;
                const isFilled = hasFilledZone(filledZoneIds, zone.zoneId);
                const zonePath = view === "full" ? zone.fullD : zone.d;
                const clipPath = view === "full"
                  ? `url(#clip-full-${sex}-${zone.view}-${zone.side})`
                  : `url(#clip-${view}-${side})`;
                return (
                  <ZonePath
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

        {/* Point labels */}
        <g className={styles.pointLabels} aria-hidden="true">
          {getZonesForSide(view, "right")
            .concat(getZonesForSide(view, "left"))
            .filter(
              (zone) =>
                zone.point === 1 ||
                zone.point % 4 === 0 ||
                zone.point ===
                  getZonesForSide(view, "right")
                    .concat(getZonesForSide(view, "left"))
                    .find((z) => z.zoneId === activeZoneId)?.point,
            )
            .map((zone) => (
              <text
                key={`label-${zone.zoneId}`}
                x={view === "full" ? zone.fullLabelX : zone.labelX}
                y={(view === "full" ? zone.fullLabelY : zone.labelY) + 3}
                data-active={zone.zoneId === activeZoneId ? "true" : "false"}
              >
                {zone.point}
              </text>
            ))}
        </g>
      </svg>

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip ? (
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
    </div>
  );
}
