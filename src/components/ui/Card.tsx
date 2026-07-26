import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  as: Tag = "section",
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cn(
        "bg-surface border-line rounded-card border shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="text-ink-3 mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-ink truncate text-[15px] leading-tight font-semibold">
            {title}
          </h2>
          {subtitle && (
            <p className="text-ink-3 mt-0.5 text-[13px] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)}>{children}</div>;
}

/** A single headline metric. `delta` is signed and coloured by direction. */
export function StatTile({
  label,
  value,
  delta,
  deltaGood,
  hint,
  icon,
  accent = "var(--series-1)",
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaGood?: boolean;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-3 text-[13px] font-medium">{label}</p>
        {icon && (
          <span
            className="grid size-7 shrink-0 place-items-center rounded-lg"
            style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="text-ink mt-2 text-2xl leading-none font-semibold tracking-tight">
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px]">
        {delta && (
          <span
            className="font-medium"
            style={{
              color:
                deltaGood === undefined
                  ? "var(--ink-3)"
                  : deltaGood
                    ? "var(--good-ink)"
                    : "var(--critical)",
            }}
          >
            {delta}
          </span>
        )}
        {hint && <span className="text-ink-3 truncate">{hint}</span>}
      </div>
    </Card>
  );
}
