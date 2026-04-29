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
  className?: string;
  ariaLabel?: string;
};

const DEFAULT_ARIA_LABEL: Record<BodyView, string> = {
  legs: "Diagrama de piernas",
  arms: "Diagrama de brazos",
};

export function BodyHighlight({
  view,
  activeZoneId,
  className,
  ariaLabel,
}: BodyHighlightProps) {
  const zones = getZonesForView(view);
  const outlines = BODY_HIGHLIGHT_OUTLINES[view];
  const svgClassName = [styles.svg, className].filter(Boolean).join(" ");

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
          return (
            <path
              key={zone.zoneId}
              d={zone.d}
              data-zone-id={zone.zoneId}
              data-active={isActive ? "true" : "false"}
              className={styles.zone}
            />
          );
        })}
      </g>
    </svg>
  );
}
