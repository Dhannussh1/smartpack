"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Ban, Droplets, ScanLine } from "lucide-react";
import { cn } from "./ui";

// Scripted demo of the core idea: scan → hidden sugars light up → claim busted → personal verdict.
type Tag = "sugar" | "fat" | null;
const INGREDIENTS: { text: string; tag: Tag }[] = [
  { text: "Refined wheat flour (maida)", tag: null },
  { text: "Palm oil", tag: "fat" },
  { text: "Maltodextrin", tag: "sugar" },
  { text: "Cocoa solids (6%)", tag: null },
  { text: "Invert syrup", tag: "sugar" },
  { text: "Milk solids", tag: null },
  { text: "Dextrose", tag: "sugar" },
  { text: "Emulsifier (E322)", tag: null },
  { text: "Salt", tag: null },
];

const PHASES = ["scan", "reveal", "claim", "verdict"] as const;
const DURATION = [2200, 2200, 1900, 3600];

export function ScanDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setPhase((p) => (p + 1) % PHASES.length), DURATION[phase]);
    return () => clearTimeout(t);
  }, [phase]);

  const step = PHASES[phase];
  const revealed = step !== "scan";

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* phone-ish frame */}
      <motion.div
        initial={{ opacity: 0, y: 30, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white p-5 text-ink shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wider text-ink-faint uppercase">Choco Crunch Cookies</p>
            <div className="relative mt-1 inline-block">
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">No added sugar ✓</span>
              <AnimatePresence>
                {(step === "claim" || step === "verdict") && (
                  <motion.span
                    key="strike"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute top-1/2 left-0 h-0.5 w-full origin-left -rotate-3 bg-bad"
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted">
            <ScanLine className="h-4 w-4 text-brand" />
          </span>
        </div>

        <p className="mt-4 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Ingredients</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {INGREDIENTS.map((ing, i) => {
            const hit = revealed && ing.tag;
            return (
              <motion.li
                key={ing.text}
                animate={hit ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ delay: hit ? 0.15 * i : 0, duration: 0.45 }}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors duration-500",
                  hit && ing.tag === "sugar" && "border-bad/30 bg-bad/10 font-semibold text-bad",
                  hit && ing.tag === "fat" && "border-warn/30 bg-warn/10 font-semibold text-warn",
                  !hit && "border-line bg-muted/60 text-ink-soft",
                )}
              >
                {ing.text}
              </motion.li>
            );
          })}
        </ul>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Sugar", "24g", "6 tsp"],
            ["Sat. fat", "9g", "per 100g"],
            ["Energy", "498", "kcal"],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-lg bg-muted px-2 py-2">
              <div className="text-[10px] text-ink-faint">{k}</div>
              <div className="text-sm font-semibold tabular-nums">{v}</div>
              <div className="text-[10px] text-ink-faint">{s}</div>
            </div>
          ))}
        </div>

        {/* scanning beam */}
        <AnimatePresence>
          {step === "scan" && (
            <motion.div
              key="beam"
              className="pointer-events-none absolute inset-x-0 top-0 h-24"
              initial={{ y: -96, opacity: 0 }}
              animate={{ y: [-96, 380], opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            >
              <div className="h-full w-full bg-gradient-to-b from-transparent via-brand/15 to-brand/30" />
              <div className="h-0.5 w-full bg-brand shadow-[0_0_16px_4px_rgb(15_138_95/0.6)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* floating callouts */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            key="sugars"
            initial={{ opacity: 0, x: 24, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
            className="absolute top-20 -right-3 flex items-center gap-2 rounded-xl bg-night-2 px-3 py-2 text-xs text-white shadow-xl ring-1 ring-white/10 sm:-right-10"
          >
            <Droplets className="h-4 w-4 text-bad" />
            <span>
              <b className="text-bad">3 hidden sugars</b> found
            </span>
          </motion.div>
        )}
        {(step === "claim" || step === "verdict") && (
          <motion.div
            key="claim"
            initial={{ opacity: 0, x: -24, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="absolute top-2 -left-3 flex items-center gap-2 rounded-xl bg-night-2 px-3 py-2 text-xs text-white shadow-xl ring-1 ring-white/10 sm:-left-12"
          >
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Claim is <b className="text-amber-300">misleading</b>
          </motion.div>
        )}
        {step === "verdict" && (
          <motion.div
            key="verdict"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="absolute inset-x-4 -bottom-8 flex items-center gap-3 rounded-2xl bg-bad px-4 py-3 text-white shadow-[0_20px_40px_-12px_rgb(214_69_69/0.7)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
              <Ban className="h-5 w-5" />
            </span>
            <span className="text-sm leading-tight">
              <b className="block text-base">AVOID, for you</b>
              Diabetic · on a sugar cut · max 0 today
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
