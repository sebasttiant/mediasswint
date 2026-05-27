"use client";

// Deterministic sparkline from a seed value.
// When real time-series data ships (Etapa 7), swap `points` prop to accept number[].
function fakeSparkline(seed: number, count = 12): number[] {
  let s = seed || 1;
  return Array.from({ length: count }, () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  });
}

type SparklineProps = {
  seed: number;
  className?: string;
  width?: number;
  height?: number;
};

export function Sparkline({ className, height = 32, seed, width = 80 }: SparklineProps) {
  const raw = fakeSparkline(seed);
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const range = max - min || 1;

  const points = raw
    .map((v, i) => {
      const x = (i / (raw.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={height}
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
