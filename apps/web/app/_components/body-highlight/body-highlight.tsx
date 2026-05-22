import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  BODY_FIGURE_CLIP_PATHS,
  BODY_FIGURE_OUTLINES,
  BODY_CLIP_PATHS,
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  getSideSummaryForView,
  getZoneA11yLabel,
  getZonesForSide,
  type BodyView,
} from "./body-highlight-zones";
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

const SIDE_LABELS: Record<BodyView, Record<string, { x: number; label: string }>> = {
  full: {
    right: { x: 32, label: "D" },
    left: { x: 208, label: "I" },
  },
  legs: {
    right: { x: 50, label: "D" },
    left: { x: 171, label: "I" },
  },
  arms: {
    right: { x: 78, label: "D" },
    left: { x: 199, label: "I" },
  },
};

export function BodyHighlight({
  view,
  sex = BODY_FIGURE_SEX.FEMALE,
  activeZoneId,
  filledZoneIds,
  className,
  ariaLabel,
  onZoneClick,
}: BodyHighlightProps) {
  const outlines = view === "full" ? BODY_FIGURE_OUTLINES[sex] : BODY_HIGHLIGHT_OUTLINES[view];
  const sideSummaries = getSideSummaryForView(view);
  const svgClassName = [styles.svg, className].filter(Boolean).join(" ");
  const isInteractive = Boolean(onZoneClick);
  const sideLabels = SIDE_LABELS[view];

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? DEFAULT_ARIA_LABEL[view]}
      viewBox={`0 0 ${BODY_HIGHLIGHT_VIEWBOX.width} ${BODY_HIGHLIGHT_VIEWBOX.height}`}
      className={svgClassName}
      data-view={view}
      data-active-zone={activeZoneId ?? ""}
    >
      <title>{ariaLabel ?? DEFAULT_ARIA_LABEL[view]}</title>
      <desc>
        {sideSummaries
          .map((summary) => `${summary.label}: ${summary.points} puntos`)
          .join(". ")}
      </desc>

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

      <g className={styles.bodyFill}>
        {outlines.map((d, index) => (
          <path key={`fill-${index}`} d={d} />
        ))}
      </g>

      <g className={styles.outline}>
        {outlines.map((d, index) => (
          <path key={`outline-${index}`} d={d} />
        ))}
      </g>

      <g className={styles.sideLabels} aria-hidden="true">
        {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
          const sl = sideLabels[side];
          const summary = sideSummaries.find((s) => s.side === side);
          return (
            <text
              key={side}
              x={sl.x}
              y={20}
              data-active={
                summary && summary.side === activeZoneId?.split(".")[1] ? "true" : "false"
              }
            >
              {sl.label}
            </text>
          );
        })}
      </g>

      {(Object.keys(sideLabels) as Array<"right" | "left">).map((side) => {
        const zones = getZonesForSide(view, side);
        return (
          <g key={side} className={styles.zoneGroup}>
            {zones.map((zone) => {
              const isActive = zone.zoneId === activeZoneId;
              const isFilled = hasFilledZone(filledZoneIds, zone.zoneId);
              const zonePath = view === "full" ? zone.fullD : zone.d;
              const clipPath = view === "full"
                ? `url(#clip-full-${sex}-${zone.view}-${zone.side})`
                : `url(#clip-${view}-${side})`;
              return (
                <path
                  key={zone.zoneId}
                  d={zonePath}
                  clipPath={clipPath}
                  data-zone-id={zone.zoneId}
                  data-side={zone.side}
                  data-point={zone.point}
                  data-active={isActive ? "true" : "false"}
                  data-filled={isFilled ? "true" : "false"}
                  className={styles.zone}
                  aria-label={getZoneA11yLabel(zone.zoneId, { active: isActive, filled: isFilled })}
                  aria-pressed={isInteractive ? isActive : undefined}
                  role={isInteractive ? "button" : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
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
                />
              );
            })}
          </g>
        );
      })}

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
  );
}
