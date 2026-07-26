import type { ReactNode } from "react";
import { clamp, cn } from "@/lib/utils";

/**
 * Meter. The fill carries severity; the track is a lighter step of the same
 * ramp so state reads across the whole bar.
 */
export function Progress({
  value,
  max = 100,
  color = "var(--accent)",
  height = 8,
  label,
  className,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", className)}
      style={{
        height,
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
      }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Stacked meter — segments separated by a 2px gap in the surface colour. */
export function StackedBar({
  segments,
  total,
  height = 10,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  height?: number;
}) {
  const safeTotal = total > 0 ? total : 1;

  return (
    <div
      className="bg-surface-2 flex w-full overflow-hidden rounded-full"
      style={{ height, gap: 2 }}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${segment.value}`}
            className="h-full transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.value / safeTotal) * 100}%`,
              background: segment.color,
            }}
          />
        ))}
    </div>
  );
}

/** Radial progress used for the daily score. */
export function Ring({
  value,
  size = 96,
  thickness = 8,
  color = "var(--accent)",
  children,
}: {
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  children?: ReactNode;
}) {
  const pct = clamp(value, 0, 100);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          style={{ stroke: `color-mix(in oklab, ${color} 16%, transparent)` }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          style={{
            stroke: color,
            transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
