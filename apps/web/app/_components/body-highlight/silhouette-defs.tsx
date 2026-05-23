"use client";

export function SilhouetteDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fde7d2" />
        <stop offset="100%" stopColor="#f5d4b3" />
      </linearGradient>

      <linearGradient id={`${id}-volume`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#c8860a" stopOpacity="0.18" />
        <stop offset="35%" stopColor="#c8860a" stopOpacity="0.04" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="65%" stopColor="#c8860a" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#c8860a" stopOpacity="0.18" />
      </linearGradient>

      <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id={`${id}-zone-glow`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
