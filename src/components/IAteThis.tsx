"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, Undo2, Utensils } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { localDay, totalsFor, type IntakeRow, type Totals } from "@/lib/intake";
import type { Analysis, EngineResult } from "@/lib/engine";
import type { Rulebook } from "@/lib/health";
import { BudgetMeter } from "./charts";
import { Button, cn } from "./ui";

/** Log a scanned product as eaten → updates today's budget (daily_intake). */
export function IAteThis({
  userId,
  scanId,
  a,
  e,
  verdict,
  rulebook,
}: {
  userId: string;
  scanId: string | null;
  a: Analysis;
  e: EngineResult;
  verdict: "SAFE" | "LIMIT" | "AVOID";
  rulebook: Rulebook | null;
}) {
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<{ id: number; totals: Totals } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const g = e.perServing.grams;
  const n = a.nutrition_per_100g ?? {};
  const per = (v: number | null | undefined) => (v == null ? 0 : (Number(v) * g * servings) / 100);
  const amounts = {
    calories: per(n.energy_kcal),
    sugar_g: per(n.added_sugar_g ?? n.total_sugar_g),
    sodium_mg: per(n.sodium_mg),
    fat_g: per(n.fat_g),
    sat_fat_g: per(n.sat_fat_g),
    protein_g: per(n.protein_g),
  };
  const round = (x: number) => Math.round(x * 10) / 10;

  async function log() {
    setBusy(true);
    setErr(null);
    const sb = supabase();
    const today = localDay();
    const { data, error } = await sb
      .from("daily_intake")
      .insert({
        user_id: userId,
        scan_id: scanId,
        day: today,
        servings,
        calories: round(amounts.calories),
        sugar_g: round(amounts.sugar_g),
        sodium_mg: round(amounts.sodium_mg),
        fat_g: round(amounts.fat_g),
        sat_fat_g: round(amounts.sat_fat_g),
        protein_g: round(amounts.protein_g),
      })
      .select("id")
      .single();
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    const { data: rows } = await sb.from("daily_intake").select("*").eq("user_id", userId).eq("day", today);
    setLogged({ id: data.id, totals: totalsFor((rows as IntakeRow[]) ?? [], today) });
    setBusy(false);
  }

  async function undo() {
    if (!logged) return;
    await supabase().from("daily_intake").delete().eq("id", logged.id);
    setLogged(null);
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <Utensils className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-ink">Did you eat this?</h3>
          <p className="mt-0.5 text-sm text-ink-soft">
            Log it to track today&apos;s sugar, salt and calories against your limits.
            {verdict === "AVOID" && <span className="text-bad"> This product isn&apos;t advised for you.</span>}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!logged ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-soft">Servings</span>
              <div className="flex items-center rounded-xl border border-line">
                <button onClick={() => setServings((s) => Math.max(0.5, s - 0.5))} className="grid h-10 w-10 place-items-center text-ink-soft hover:text-ink" aria-label="Fewer servings">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-semibold text-ink tabular-nums" aria-live="polite">{servings}</span>
                <button onClick={() => setServings((s) => Math.min(10, s + 0.5))} className="grid h-10 w-10 place-items-center text-ink-soft hover:text-ink" aria-label="More servings">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-ink-faint">× {g} g</span>
            </div>
            <p className="flex-1 text-sm text-ink-soft tabular-nums">
              {Math.round(amounts.calories)} kcal · {round(amounts.sugar_g)} g sugar · {Math.round(amounts.sodium_mg)} mg sodium
            </p>
            <Button onClick={log} loading={busy} variant={verdict === "AVOID" ? "outline" : "primary"}>
              <Check className="h-4 w-4" /> I ate this
            </Button>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-good">
                <Check className="h-4 w-4" /> Logged {servings} serving{servings === 1 ? "" : "s"}
              </span>
              <button onClick={undo} className="inline-flex items-center gap-1 text-ink-soft underline-offset-2 hover:text-ink hover:underline">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <Link href="/dashboard" className="ml-auto font-medium text-brand hover:underline">
                See today&apos;s budget →
              </Link>
            </p>
            {rulebook && (
              <div className={cn("mt-4 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3")}>
                <BudgetMeter label="Sugar today" used={logged.totals.sugar_g} limit={rulebook.sugar_g_max} unit="g" decimals={1} />
                <BudgetMeter label="Sodium today" used={logged.totals.sodium_mg} limit={rulebook.sodium_mg_max} unit="mg" />
                <BudgetMeter label="Calories today" used={logged.totals.calories} limit={rulebook.daily_kcal} unit="kcal" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {err && <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
    </section>
  );
}
