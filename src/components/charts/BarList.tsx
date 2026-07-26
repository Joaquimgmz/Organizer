import { cn } from "@/lib/utils";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * Horizontal category bars, rendered as plain HTML rather than SVG.
 *
 * Recharts' `layout="vertical"` produced no category scale in v3, and for a
 * ranked list of categories the chart library buys nothing: this reflows at any
 * width, needs no measurement pass, keeps the value labels selectable, and
 * exposes the numbers to screen readers as a definition list.
 *
 * Colour comes from each row, so a category keeps its colour regardless of
 * where it lands in the sort order.
 */
export function BarList({
  rows,
  format = (value) => value.toLocaleString(),
  className,
}: {
  rows: BarRow[];
  format?: (value: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <dl className={cn("space-y-2", className)}>
      {rows.map((row) => (
        <div key={row.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <dt className="text-ink-2 flex min-w-0 items-center gap-1.5 text-[12.5px]">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: row.color }}
              />
              <span className="truncate">{row.label}</span>
            </dt>
            <dd className="text-ink shrink-0 text-[12.5px] font-medium tabular-nums">
              {format(row.value)}
            </dd>
          </div>
          <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: row.color,
              }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
