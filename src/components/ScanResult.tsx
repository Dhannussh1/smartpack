"use client";

import { motion } from "motion/react";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, Droplets, Lightbulb, ShieldAlert, Volume2 } from "lucide-react";
import type { Analysis, EngineResult } from "@/lib/engine";
import { Stagger, Item, CountUp } from "./motion";
import { cn } from "./ui";

const TONE = {
  SAFE: { bg: "bg-good", ring: "shadow-[0_20px_50px_-20px_rgb(19_138_82/0.9)]", icon: CheckCircle2, label: "SAFE for you" },
  LIMIT: { bg: "bg-warn", ring: "shadow-[0_20px_50px_-20px_rgb(183_121_31/0.9)]", icon: AlertTriangle, label: "LIMIT it" },
  AVOID: { bg: "bg-bad", ring: "shadow-[0_20px_50px_-20px_rgb(214_69_69/0.9)]", icon: Ban, label: "AVOID, for you" },
};

function speak(text: string, lang: "en-IN" | "ta-IN") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function ScanResult({ a, e, verdict }: { a: Analysis; e: EngineResult; verdict: "SAFE" | "LIMIT" | "AVOID" }) {
  const t = TONE[verdict];
  const misleading = a.claim_checks.filter((c) => c.verdict === "misleading");
  const flagged = new Map(e.flags.map((f) => [f.ingredient, f]));

  return (
    <Stagger className="space-y-4 text-ink" gap={0.08}>
      <Item>
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn("rounded-3xl p-5 text-white", t.bg, t.ring)}
        >
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
              <t.icon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-wide text-white/75 uppercase">{a.product.brand ?? ""} {a.product.name ?? "This product"}</p>
              <p className="text-2xl font-semibold">{t.label}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums"><CountUp value={a.score} /></div>
              <div className="text-[10px] text-white/75">/ 100</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/90">{e.forcedReason ?? a.headline}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => speak(a.summary_en, "en-IN")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30">
              <Volume2 className="h-3.5 w-3.5" /> English
            </button>
            <button onClick={() => speak(a.summary_ta, "ta-IN")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30">
              <Volume2 className="h-3.5 w-3.5" /> தமிழ்
            </button>
          </div>
        </motion.div>
      </Item>

      {(e.allergenHits.length > 0 || e.dietHits.length > 0) && (
        <Item>
          <div className="flex items-start gap-3 rounded-2xl border-2 border-bad bg-bad/10 p-4 text-sm font-semibold text-bad">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            {e.allergenHits.length > 0 && <>Allergen alert: {e.allergenHits.join(", ")}. </>}
            {e.dietHits.length > 0 && <>Not suitable for your diet ({e.dietHits.join(", ")}).</>}
          </div>
        </Item>
      )}

      <Item>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-ink-soft">Safe amount today</p>
            <p className="mt-1 text-2xl font-semibold">
              {e.maxServings == null ? "?" : e.maxServings === 0 ? "None" : `${e.maxServings} serving${e.maxServings === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs text-ink-faint">
              1 serving = {e.perServing.grams} g{e.limitingNutrient ? ` · limited by ${e.limitingNutrient}` : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-ink-soft">Sugar per serving</p>
            <p className="mt-1 text-2xl font-semibold">{e.sugarTsp ?? "?"} <span className="text-sm font-normal text-ink-soft">tsp</span></p>
            <div className="mt-1 flex flex-wrap gap-0.5">
              {Array.from({ length: Math.min(12, Math.ceil(e.sugarTsp ?? 0)) }).map((_, i) => (
                <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.06 }} className="h-3 w-3 rounded-sm bg-amber-200 ring-1 ring-amber-400" />
              ))}
            </div>
          </div>
        </div>
      </Item>

      <Item>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="font-medium">Why, for you</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {a.reasons.map((r) => (
              <li key={r} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{r}</li>
            ))}
          </ul>
        </div>
      </Item>

      {a.claim_checks.length > 0 && (
        <Item>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="font-medium">Label Lie Detector · {a.claim_checks.length} claims checked, <span className={misleading.length ? "text-bad" : "text-good"}>{misleading.length} misleading</span></p>
            <ul className="mt-2 space-y-2 text-sm">
              {a.claim_checks.map((c) => (
                <li key={c.claim} className="flex gap-2">
                  {c.verdict === "misleading" ? <Ban className="mt-0.5 h-4 w-4 shrink-0 text-bad" /> : c.verdict === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}
                  <span><b className={c.verdict === "misleading" ? "text-bad line-through" : ""}>{c.claim}</b> <span className="text-ink-soft">{c.reason}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Item>
      )}

      <Item>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 font-medium"><Droplets className="h-4 w-4 text-bad" /> Ingredients · {e.hiddenSugars.length} sugar source{e.hiddenSugars.length === 1 ? "" : "s"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {a.ingredients.map((ing, i) => {
              const f = flagged.get(ing);
              return (
                <span
                  key={ing + i}
                  title={f?.note}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    f?.category === "hidden_sugar" && "border-bad/30 bg-bad/10 font-semibold text-bad",
                    f && f.category !== "hidden_sugar" && "border-warn/30 bg-warn/10 font-medium text-warn",
                    !f && "border-line bg-muted text-ink-soft",
                  )}
                >
                  {ing}
                </span>
              );
            })}
          </div>
          {e.flags.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              {e.flags.map((f, i) => <li key={i}><b className="text-ink">{f.ingredient}:</b> {f.note}</li>)}
            </ul>
          )}
        </div>
      </Item>

      <Item>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-soft"><CalendarClock className="h-3.5 w-3.5" /> Expiry</p>
            <p className={cn("mt-1 font-medium", e.expiry.status === "expired" && "text-bad", e.expiry.status === "soon" && "text-warn", e.expiry.status === "ok" && "text-good")}>{e.expiry.text}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-ink-soft">Per serving</p>
            <p className="mt-1 font-medium">{e.perServing.kcal ?? "?"} kcal · {e.perServing.sodium ?? "?"} mg sodium</p>
          </div>
        </div>
      </Item>

      {(a.tips.length > 0 || a.alternatives.length > 0) && (
        <Item>
          <div className="rounded-2xl border border-line bg-white p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><Lightbulb className="h-4 w-4 text-brand" /> Better choices</p>
            <ul className="mt-2 space-y-1 text-ink-soft">
              {[...a.tips, ...a.alternatives.map((x) => `Try: ${x}`)].map((x) => <li key={x}>• {x}</li>)}
            </ul>
          </div>
        </Item>
      )}

      <p className="pb-2 text-center text-[11px] text-ink-soft">Guidance, not medical advice · AI confidence {Math.round((a.confidence ?? 0) * (a.confidence > 1 ? 1 : 100))}%</p>
    </Stagger>
  );
}
