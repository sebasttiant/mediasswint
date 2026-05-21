import type { AnatomyZoneId } from "@/lib/compression-measurements";

import {
  BODY_HIGHLIGHT_OUTLINES,
  BODY_HIGHLIGHT_VIEWBOX,
  getZonesForView,
  type BodyView,
} from "./body-highlight-zones";
import styles from "./body-highlight.module.css";

export type BodyHighlightProps = {
  view: BodyView;
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
  legs: "Diagrama de piernas",
  arms: "Diagrama de brazos",
};

export function BodyHighlight({
  view,
  activeZoneId,
  filledZoneIds,
  className,
  ariaLabel,
  onZoneClick,
}: BodyHighlightProps) {
  const zones = getZonesForView(view);
  const outlines = BODY_HIGHLIGHT_OUTLINES[view];
  const svgClassName = [styles.svg, className].filter(Boolean).join(" ");
  const isInteractive = Boolean(onZoneClick);

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? DEFAULT_ARIA_LABEL[view]}
      viewBox={`0 0 ${BODY_HIGHLIGHT_VIEWBOX.width} ${BODY_HIGHLIGHT_VIEWBOX.height}`}
      className={svgClassName}
      data-view={view}
      data-active-zone={activeZoneId ?? ""}
    >
      <g className={styles.outline}>
        {outlines.map((d, index) => (
          <path key={`outline-${index}`} d={d} />
        ))}
      </g>
      <g>
        {zones.map((zone) => {
          const isActive = zone.zoneId === activeZoneId;
          const isFilled = hasFilledZone(filledZoneIds, zone.zoneId);
          return (
            <path
              key={zone.zoneId}
              d={zone.d}
              data-zone-id={zone.zoneId}
              data-active={isActive ? "true" : "false"}
              data-filled={isFilled ? "true" : "false"}
              className={styles.zone}
              aria-label={zone.zoneId}
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
    </svg>
  );
}
