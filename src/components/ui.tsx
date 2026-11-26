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
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", light ? "text-white" : "text-ink", className)}>
      <motion.span
        className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-brand text-white"
        whileHover={{ rotate: -6, scale: 1.06 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" strokeLinecap="round" />
          <path d="M8.5 12.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.span>
      SmartPack
    </span>
  );
}

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "outline" | "ghost" | "light";
  loading?: boolean;
  children?: ReactNode;
};

export function Button({ className, variant = "primary", loading, children, disabled, ...props }: ButtonProps) {
  const off = disabled || loading;
  return (
    <motion.button
      {...props}
      disabled={off}
      whileHover={off ? undefined : { y: -1 }}
      whileTap={off ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-brand text-white shadow-[0_6px_20px_-8px_rgb(15_138_95/0.7)] hover:bg-brand-dark",
        variant === "outline" && "border border-line bg-white text-ink hover:bg-muted",
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
  return (
    <div className={cn("rounded-2xl border border-line/80 bg-white p-5 shadow-[0_1px_2px_rgb(20_32_27/0.04),0_8px_24px_-12px_rgb(20_32_27/0.12)]", className)}>
      {children}
    </div>
  );
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
      {hint && <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>}
    </Tag>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-ink-faint/60 focus:border-brand focus:ring-4 focus:ring-brand/12";

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
            whileTap={{ scale: 0.94 }}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              on
                ? "border-brand bg-brand text-white shadow-[0_4px_12px_-6px_rgb(15_138_95/0.8)]"
                : "border-line bg-white text-ink-soft hover:border-ink-faint hover:text-ink",
            )}
          >
            {on && (
              <motion.span initial={{ scale: 0, width: 0 }} animate={{ scale: 1, width: "auto" }} className="inline-flex">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            )}
            {o.label}
          </motion.button>
        );
      })}
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <motion.div
        className="h-10 w-10 rounded-xl border-2 border-brand/25 border-t-brand"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
      />
    </div>
  );
}

/** Soft blurred colour blobs for page backgrounds. */
export function Glow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-lime/20 blur-3xl" />
    </div>
  );
}
