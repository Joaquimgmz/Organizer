"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Small purpose-built SVG charts.
 *
 * Written by hand rather than pulled from a chart library: Recharts 3 rendered
 * bars and axis ticks inconsistently here (empty rectangle groups after a
 * client-side navigation), and these two forms are all the app needs. Being
 * plain SVG also means the marks follow the project's design tokens exactly and
 * every value stays reachable from the tooltip and the accessible summary.
 *
 * Mark specs: 2px lines with round caps, bars capped at 24px with a 4px rounded
 * data-end squared at the baseline, >=8px markers ringed in the surface colour,
 * hairline horizontal gridlines only, and all text in ink tokens.
 */

// ── Scale helpers ────────────────────────────────────────────────────────────

/** Round a domain out to human numbers (1 / 2 / 2.5 / 5 x 10^n steps). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return min === 0 ? [0, 1] : [0, max];

  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) *
    magnitude;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    // Guard against float drift producing -0 or 0.30000000000000004
    ticks.push(Math.round(value / step) * step);
  }
  return ticks;
}

/** Track the rendered width of the chart so marks land on real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => setWidth(element.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

type Row = Record<string, string | number | null | undefined>;

// ── Shared chrome ────────────────────────────────────────────────────────────

function Tooltip({
  x,
  width,
  children,
}: {
  x: number;
  width: number;
  children: ReactNode;
}) {
  // Keep the card inside the plot area rather than letting it clip.
  const CARD = 168;
  const left = Math.min(Math.max(x - CARD / 2, 4), Math.max(4, width - CARD - 4));

  return (
    <div
      className="bg-surface border-line pointer-events-none absolute top-1 z-10 rounded-lg border px-2.5 py-2 shadow-[var(--shadow)]"
      style={{ left, width: CARD }}
    >
      {children}
    </div>
  );
}

function TooltipRows({
  heading,
  rows,
}: {
  heading: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <>
      <p className="text-ink mb-1 text-[12px] font-medium">{heading}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-1.5 text-[12px]">
            {row.color && (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: row.color }}
              />
            )}
            <span className="text-ink-3">{row.label}</span>
            <span className="text-ink ml-auto font-medium tabular-nums">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Estimate the gutter needed for the y-axis labels. */
function gutterFor(labels: string[]) {
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0);
  return Math.min(72, Math.max(28, longest * 6.6 + 10));
}

/** Thin out x labels until they stop colliding. */
function labelStride(count: number, plotWidth: number, minGap = 46) {
  if (count === 0) return 1;
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / minGap))));
}

const TOP = 10;
const BOTTOM = 22;

// ── Column chart ─────────────────────────────────────────────────────────────

export function ColumnChart({
  data,
  xKey,
  valueKey,
  color = "var(--series-1)",
  height = 208,
  formatValue = (value) => value.toLocaleString(),
  formatTick,
  seriesLabel,
  className,
}: {
  data: Row[];
  xKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  seriesLabel?: string;
  className?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const values = data.map((row) => Number(row[valueKey]) || 0);
  const ticks = useMemo(() => niceTicks(0, Math.max(...values, 1)), [values.join()]);
  const top = ticks[ticks.length - 1] || 1;

  const tickLabels = ticks.map((tick) => (formatTick ?? formatValue)(tick));
  const gutter = gutterFor(tickLabels);
  const plotWidth = Math.max(0, width - gutter - 8);
  const plotHeight = height - TOP - BOTTOM;

  const band = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.min(24, Math.max(3, band - 6));
  const stride = labelStride(data.length, plotWidth);

  const yOf = (value: number) => TOP + plotHeight * (1 - value / top);

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }}>
      {width > 0 && (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${seriesLabel ?? valueKey} chart`}
            onMouseLeave={() => setHover(null)}
          >
            {/* Gridlines + y labels */}
            {ticks.map((tick, index) => (
              <g key={tick}>
                <line
                  x1={gutter}
                  x2={width - 8}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke="var(--grid)"
                  strokeWidth={1}
                />
                <text
                  x={gutter - 8}
                  y={yOf(tick) + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--ink-3)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tickLabels[index]}
                </text>
              </g>
            ))}

            {/* Bars: rounded at the data end, square at the baseline */}
            {data.map((row, index) => {
              const value = Number(row[valueKey]) || 0;
              const x = gutter + band * index + (band - barWidth) / 2;
              const y = yOf(value);
              const barHeight = Math.max(0, TOP + plotHeight - y);
              const radius = Math.min(4, barWidth / 2, barHeight);
              const active = hover === index;

              return (
                <g key={index}>
                  {barHeight > 0 && (
                    <path
                      d={`M${x},${y + barHeight} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + barWidth - radius},${y} Q${x + barWidth},${y} ${x + barWidth},${y + radius} L${x + barWidth},${y + barHeight} Z`}
                      fill={color}
                      opacity={hover === null || active ? 1 : 0.45}
                      style={{ transition: "opacity 120ms" }}
                    />
                  )}
                  {/* Hit target spans the whole band, not just the bar */}
                  <rect
                    x={gutter + band * index}
                    y={TOP}
                    width={band}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHover(index)}
                  />
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={gutter}
              x2={width - 8}
              y1={TOP + plotHeight}
              y2={TOP + plotHeight}
              stroke="var(--axis)"
              strokeWidth={1}
            />

            {/* x labels */}
            {data.map((row, index) =>
              index % stride === 0 ? (
                <text
                  key={index}
                  x={gutter + band * index + band / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--ink-3)"
                >
                  {String(row[xKey] ?? "")}
                </text>
              ) : null,
            )}
          </svg>

          {hover !== null && data[hover] && (
            <Tooltip x={gutter + band * hover + band / 2} width={width}>
              <TooltipRows
                heading={String(data[hover][xKey] ?? "")}
                rows={[
                  {
                    label: seriesLabel ?? valueKey,
                    value: formatValue(Number(data[hover][valueKey]) || 0),
                    color,
                  },
                ]}
              />
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}

// ── Line chart ───────────────────────────────────────────────────────────────

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  /** Reference lines render thinner and without markers. */
  reference?: boolean;
};

export function LineChart({
  data,
  xKey,
  series,
  height = 208,
  formatValue = (value) => value.toLocaleString(),
  formatTick,
  yDomain,
  className,
}: {
  data: Row[];
  xKey: string;
  series: LineSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  /** Pad the domain around the data instead of anchoring at zero. */
  yDomain?: "auto" | "zero";
  className?: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const numbers = data.flatMap((row) =>
    series
      .map((line) => Number(row[line.key]))
      .filter((value) => Number.isFinite(value)),
  );

  const ticks = useMemo(() => {
    if (numbers.length === 0) return [0, 1];
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    if (yDomain === "auto") {
      const pad = Math.max(1, (max - min) * 0.15);
      return niceTicks(min - pad, max + pad);
    }
    return niceTicks(0, max);
  }, [numbers.join(), yDomain]);

  const low = ticks[0];
  const high = ticks[ticks.length - 1];
  const span = high - low || 1;

  const tickLabels = ticks.map((tick) => (formatTick ?? formatValue)(tick));
  const gutter = gutterFor(tickLabels);
  const plotWidth = Math.max(0, width - gutter - 10);
  const plotHeight = height - TOP - BOTTOM;

  const xOf = useCallback(
    (index: number) =>
      gutter + (data.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (data.length - 1)),
    [gutter, plotWidth, data.length],
  );
  const yOf = (value: number) => TOP + plotHeight * (1 - (value - low) / span);

  const stride = labelStride(data.length, plotWidth);

  /** Build a path, breaking it wherever a point is missing. */
  const pathFor = (key: string) => {
    let path = "";
    let open = false;

    data.forEach((row, index) => {
      const value = Number(row[key]);
      if (!Number.isFinite(value)) {
        open = false;
        return;
      }
      path += `${open ? "L" : "M"}${xOf(index).toFixed(2)},${yOf(value).toFixed(2)}`;
      open = true;
    });

    return path;
  };

  // Nearest point to the pointer.
  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const ratio = (x - gutter) / (plotWidth || 1);
    const index = Math.round(ratio * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, index)));
  };

  const multi = series.length > 1;

  return (
    <div className={cn("w-full", className)}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`${series.map((line) => line.label).join(" and ")} chart`}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              {ticks.map((tick, index) => (
                <g key={tick}>
                  <line
                    x1={gutter}
                    x2={width - 10}
                    y1={yOf(tick)}
                    y2={yOf(tick)}
                    stroke="var(--grid)"
                    strokeWidth={1}
                  />
                  <text
                    x={gutter - 8}
                    y={yOf(tick) + 3.5}
                    textAnchor="end"
                    fontSize={11}
                    fill="var(--ink-3)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {tickLabels[index]}
                  </text>
                </g>
              ))}

              {/* Crosshair */}
              {hover !== null && (
                <line
                  x1={xOf(hover)}
                  x2={xOf(hover)}
                  y1={TOP}
                  y2={TOP + plotHeight}
                  stroke="var(--line-strong)"
                  strokeWidth={1}
                />
              )}

              {/* Reference series first, so real data sits on top */}
              {[...series]
                .sort((a, b) => Number(b.reference) - Number(a.reference))
                .map((line) => (
                  <path
                    key={line.key}
                    d={pathFor(line.key)}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

              {/* Markers: only on the hovered point, ringed in the surface colour */}
              {hover !== null &&
                series
                  .filter((line) => !line.reference)
                  .map((line) => {
                    const value = Number(data[hover][line.key]);
                    if (!Number.isFinite(value)) return null;
                    return (
                      <circle
                        key={line.key}
                        cx={xOf(hover)}
                        cy={yOf(value)}
                        r={4.5}
                        fill={line.color}
                        stroke="var(--surface)"
                        strokeWidth={2}
                      />
                    );
                  })}

              <line
                x1={gutter}
                x2={width - 10}
                y1={TOP + plotHeight}
                y2={TOP + plotHeight}
                stroke="var(--axis)"
                strokeWidth={1}
              />

              {data.map((row, index) =>
                index % stride === 0 ? (
                  <text
                    key={index}
                    x={xOf(index)}
                    y={height - 6}
                    textAnchor={
                      index === 0
                        ? "start"
                        : index === data.length - 1
                          ? "end"
                          : "middle"
                    }
                    fontSize={11}
                    fill="var(--ink-3)"
                  >
                    {String(row[xKey] ?? "")}
                  </text>
                ) : null,
              )}
            </svg>

            {hover !== null && data[hover] && (
              <Tooltip x={xOf(hover)} width={width}>
                <TooltipRows
                  heading={String(data[hover][xKey] ?? "")}
                  rows={series
                    .filter((line) =>
                      Number.isFinite(Number(data[hover][line.key])),
                    )
                    .map((line) => ({
                      label: line.label,
                      value: formatValue(Number(data[hover][line.key])),
                      color: line.color,
                    }))}
                />
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* A legend is always present once there are two or more series */}
      {multi && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((line) => (
            <span
              key={line.key}
              className="flex items-center gap-1.5 text-[12.5px]"
            >
              <span
                aria-hidden
                className="h-0.5 w-4 rounded"
                style={{ background: line.color }}
              />
              <span className="text-ink-2">{line.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
