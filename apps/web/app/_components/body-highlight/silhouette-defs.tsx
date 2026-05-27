"use client";

export function SilhouetteDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* Soft clinical glow — tight, controlled, no halo bleed */}
      <filter
        id={`${id}-zone-glow`}
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        filterUnits="objectBoundingBox"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="blurAlpha" />
        <feFlood floodColor="#0ea5e9" floodOpacity="0.55" result="glowColor" />
        <feComposite in="glowColor" in2="blurAlpha" operator="in" result="coloredGlow" />
        <feMerge>
          <feMergeNode in="coloredGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Subtle inner shading gradient for the silhouette fill */}
      <linearGradient id={`${id}-body-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f7f9fc" />
        <stop offset="1" stopColor="#e5ebf2" />
      </linearGradient>
    </defs>
  );
}
