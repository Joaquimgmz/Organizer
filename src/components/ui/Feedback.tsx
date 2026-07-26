import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "animate-spin-slow border-ink-3 inline-block size-4 rounded-full border-2 border-t-transparent",
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-surface-2 animate-pulse-soft rounded-lg", className)}
      aria-hidden
    />
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="bg-surface-2 text-ink-3 mb-3 grid size-11 place-items-center rounded-xl">
          {icon}
        </div>
      )}
      <p className="text-ink text-sm font-medium">{title}</p>
      {message && (
        <p className="text-ink-3 mt-1 max-w-sm text-[13px] leading-relaxed">
          {message}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
  className?: string;
}) {
  const color = {
    info: "var(--accent)",
    warning: "var(--warning)",
    danger: "var(--critical)",
    success: "var(--good)",
  }[tone];

  return (
    <div
      className={cn("rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed", className)}
      style={{
        background: `color-mix(in oklab, ${color} 8%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
        color: "var(--ink-2)",
      }}
    >
      {children}
    </div>
  );
}
