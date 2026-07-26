"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full bg-surface border border-line rounded-lg px-3 text-sm text-ink " +
  "placeholder:text-ink-3 transition-colors duration-150 " +
  "hover:border-line-strong focus:border-accent focus:outline-none " +
  "focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_25%,transparent)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-ink-2 text-[13px] font-medium">
        {children}
      </label>
      {hint && <span className="text-ink-3 text-[12px]">{hint}</span>}
    </div>
  );
}

type FieldWrap = { label?: string; hint?: ReactNode; error?: string };

export function Input({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldWrap) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <div className="min-w-0">
      {label && (
        <Label htmlFor={fieldId} hint={hint}>
          {label}
        </Label>
      )}
      <input
        id={fieldId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          "h-9.5",
          error && "border-critical focus:border-critical",
          className,
        )}
      />
      {error && <p className="text-critical mt-1 text-[12.5px]">{error}</p>}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  id,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrap) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <div className="min-w-0">
      {label && (
        <Label htmlFor={fieldId} hint={hint}>
          {label}
        </Label>
      )}
      <textarea
        id={fieldId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={cn(
          CONTROL,
          "resize-y py-2.5 leading-relaxed",
          error && "border-critical",
          className,
        )}
      />
      {error && <p className="text-critical mt-1 text-[12.5px]">{error}</p>}
    </div>
  );
}

export function Select({
  label,
  hint,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldWrap) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <div className="min-w-0">
      {label && (
        <Label htmlFor={fieldId} hint={hint}>
          {label}
        </Label>
      )}
      <div className="relative">
        <select
          id={fieldId}
          {...rest}
          className={cn(CONTROL, "h-9.5 cursor-pointer appearance-none pr-8", className)}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="text-ink-3 pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2 select-none",
        className,
      )}
    >
      <span className="relative grid place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "grid size-[18px] place-items-center rounded-[5px] border",
            "transition-all duration-150",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[color-mix(in_oklab,var(--accent)_35%,transparent)]",
            checked
              ? "border-accent bg-accent"
              : "border-line-strong group-hover:border-accent",
          )}
        >
          <svg
            viewBox="0 0 14 14"
            aria-hidden
            className={cn(
              "text-accent-ink size-3 transition-all duration-150",
              checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
          >
            <path
              d="M2.5 7.5l3 3 6-6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      {label && <span className="text-ink-2 text-sm">{label}</span>}
    </label>
  );
}

/** Segmented control — a nicer radio group for 2–5 short options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-surface-2 border-line inline-flex rounded-lg border p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[7px] font-medium transition-all duration-150",
              size === "sm" ? "px-2 py-1 text-[12.5px]" : "px-2.5 py-1.5 text-[13px]",
              active
                ? "bg-surface text-ink shadow-[var(--shadow-sm)]"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
