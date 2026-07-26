"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover shadow-sm active:translate-y-px",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong active:translate-y-px",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  subtle: "bg-surface-2 text-ink hover:bg-surface-3",
  danger:
    "bg-critical text-white hover:brightness-110 shadow-sm active:translate-y-px",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9.5 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9.5 w-9.5 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-lg",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap " +
  "transition-all duration-150 select-none " +
  "disabled:pointer-events-none disabled:opacity-50";

function classes(variant: Variant, size: Size, className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={classes(variant, size, className)}
    >
      {loading && (
        <span
          aria-hidden
          className="animate-spin-slow size-3.5 rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

/**
 * A link that looks like a button. Used instead of nesting <Link> inside
 * <Button>, which would produce an invalid <a> inside <button>.
 */
export function LinkButton({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <Link href={href} {...rest} className={classes(variant, size, className)}>
      {children}
    </Link>
  );
}
