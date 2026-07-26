import { AlertTriangle, ArrowDown, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityCategory, ExpenseCategory, Priority } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode;
  /** Any CSS colour; the chip is a soft wash of it with matching ink. */
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] leading-none font-medium",
        !color && "bg-surface-2 text-ink-2",
        className,
      )}
      style={
        color
          ? {
              background: `color-mix(in oklab, ${color} 14%, transparent)`,
              color: `color-mix(in oklab, ${color} 78%, var(--ink))`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/** Category → chart slot. Fixed mapping so a category keeps its colour. */
export const ACTIVITY_COLORS: Record<ActivityCategory, string> = {
  work: "var(--series-1)",
  school: "var(--series-7)",
  study: "var(--series-3)",
  gym: "var(--series-2)",
  food: "var(--series-4)",
  rest: "var(--series-5)",
  personal: "var(--series-6)",
  other: "var(--ink-3)",
};

export const EXPENSE_COLORS: Record<ExpenseCategory, string> = {
  bills: "var(--series-1)",
  food: "var(--series-2)",
  transport: "var(--series-3)",
  shopping: "var(--series-4)",
  entertainment: "var(--series-5)",
  savings: "var(--series-6)",
  subscriptions: "var(--series-7)",
  health: "var(--series-8)",
  other: "var(--ink-3)",
};

export function CategoryBadge({ category }: { category: ActivityCategory }) {
  return <Badge color={ACTIVITY_COLORS[category]}>{titleCase(category)}</Badge>;
}

export function ExpenseCategoryBadge({ category }: { category: ExpenseCategory }) {
  return <Badge color={EXPENSE_COLORS[category]}>{titleCase(category)}</Badge>;
}

/**
 * Priority carries meaning, so it pairs colour with an icon and a label rather
 * than relying on hue alone.
 */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = {
    high: { color: "var(--critical)", Icon: AlertTriangle, label: "High" },
    medium: { color: "var(--warning)", Icon: Minus, label: "Medium" },
    low: { color: "var(--ink-3)", Icon: ArrowDown, label: "Low" },
  }[priority];

  return (
    <Badge color={config.color}>
      <config.Icon className="size-3" aria-hidden />
      {config.label}
    </Badge>
  );
}

/** A coloured dot + text label, for legends where text must stay in ink tokens. */
export function LegendKey({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-[3px]"
        style={{ background: color }}
      />
      <span className="text-ink-2">{label}</span>
      {value !== undefined && (
        <span className="text-ink font-medium tabular-nums">{value}</span>
      )}
    </span>
  );
}
