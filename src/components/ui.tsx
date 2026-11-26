"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Check, Loader2 } from "lucide-react";
import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", light ? "text-white" : "text-ink", className)}>
      <span className={cn("grid h-8 w-8 place-items-center rounded-lg", light ? "bg-white text-brand" : "bg-brand text-white")}>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" strokeLinecap="round" />
          <path d="M8.5 12.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight">SmartPack</span>
    </span>
  );
}

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "outline" | "ghost" | "light" | "dark";
  size?: "md" | "lg";
  loading?: boolean;
  children?: ReactNode;
};

export function Button({ className, variant = "primary", size = "md", loading, children, disabled, ...props }: ButtonProps) {
  const off = disabled || loading;
  return (
    <motion.button
      {...props}
      disabled={off}
      whileTap={off ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-11 px-5 text-sm" : "h-13 px-6 text-[15px]",
        variant === "primary" && "bg-brand text-white hover:bg-brand-dark",
        variant === "dark" && "bg-ink text-white hover:bg-ink/90",
        variant === "outline" && "border border-line bg-white text-ink hover:border-ink-faint/60",
        variant === "ghost" && "text-ink-soft hover:bg-muted hover:text-ink",
        variant === "light" && "bg-white text-ink hover:bg-white/90",
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-white p-6", className)}>{children}</div>;
}

export function Field({
  label,
  hint,
  required,
  group,
  children,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  /** true for chip groups: a <label> would forward clicks to the first chip */
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-2 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-relaxed text-ink-soft">{hint}</span>}
    </Tag>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-ink-faint/50 focus:border-brand focus:ring-4 focus:ring-brand/10";

export function Chips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <motion.button
            type="button"
            key={o.id}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              on ? "border-brand bg-brand-soft font-medium text-brand-dark" : "border-line bg-white text-ink-soft hover:border-ink-faint/60 hover:text-ink",
            )}
          >
            {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-page">
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
    </div>
  );
}

/** Soft background tint for standalone pages. */
export function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-brand/8 blur-3xl" />
    </div>
  );
}

/** Small status pill. */
export function Pill({ tone = "neutral", children }: { tone?: "good" | "warn" | "bad" | "neutral" | "brand"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "good" && "bg-good/10 text-good",
        tone === "warn" && "bg-warn/10 text-warn",
        tone === "bad" && "bg-bad/10 text-bad",
        tone === "brand" && "bg-brand-soft text-brand-dark",
        tone === "neutral" && "bg-muted text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}
