"use client";

import { motion } from "motion/react";
import { AlertTriangle, Ban, CheckCircle2, ShieldAlert, Volume2 } from "lucide-react";
import type { Analysis, EngineResult } from "@/lib/engine";
import { CountUp } from "./motion";
import { cn } from "./ui";

const TONE = {
  SAFE: { text: "text-good", bg: "bg-good", soft: "bg-good/8", icon: CheckCircle2, label: "Safe for you" },
  LIMIT: { text: "text-warn", bg: "bg-warn", soft: "bg-warn/8", icon: AlertTriangle, label: "Limit it" },
  AVOID: { text: "text-bad", bg: "bg-bad", soft: "bg-bad/8", icon: Ban, label: "Avoid" },
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

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ScanResult({ a, e, verdict }: { a: Analysis; e: EngineResult; verdict: "SAFE" | "LIMIT" | "AVOID" }) {
  const t = TONE[verdict];
  const misleading = a.claim_checks.filter((c) => c.verdict === "misleading");
  const flagged = new Map(e.flags.map((f) => [f.ingredient, f]));
  const n = a.nutrition_per_100g ?? {};
  const nutrition: [string, number | null | undefined, string][] = [
    ["Energy", n.energy_kcal, "kcal"],
    ["Protein", n.protein_g, "g"],
    ["Carbohydrate", n.carbs_g, "g"],
    ["Total sugars", n.total_sugar_g, "g"],
    ["Added sugars", n.added_sugar_g, "g"],
    ["Total fat", n.fat_g, "g"],
    ["Saturated fat", n.sat_fat_g, "g"],
    ["Trans fat", n.trans_fat_g, "g"],
    ["Sodium", n.sodium_mg, "mg"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
      {/* verdict panel */}
      <motion.aside
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-2xl border border-line bg-white lg:sticky lg:top-8"
      >
        <div className={cn("h-1.5", t.bg)} />
        <div className="p-6">
          <p className="text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">{[a.product.brand, a.product.name].filter(Boolean).join(" · ") || "This product"}</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className={cn("flex items-center gap-2 text-sm font-semibold", t.text)}>
                <t.icon className="h-4 w-4" /> {verdict}
              </p>
              <p className="mt-1 font-display text-4xl leading-none text-ink">{t.label}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-semibold tracking-tight text-ink tabular-nums">
                <CountUp value={Math.round(a.score)} />
              </p>
              <p className="text-xs text-ink-faint">score / 100</p>
            </div>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-ink">{e.forcedReason ?? a.headline}</p>

          {(e.allergenHits.length > 0 || e.dietHits.length > 0) && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-bad/8 px-3.5 py-3 text-sm font-semibold text-bad">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {e.allergenHits.length > 0 && <>Allergen: {e.allergenHits.join(", ")}. </>}
                {e.dietHits.length > 0 && <>Not suitable for your diet.</>}
              </span>
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
            <div className="bg-white p-4">
              <dt className="text-xs text-ink-soft">Safe amount today</dt>
              {/* an AVOID verdict must never be paired with "N servings are fine" */}
              <dd className={cn("mt-1 text-xl font-semibold", verdict === "AVOID" ? "text-bad" : "text-ink")}>
                {verdict === "AVOID" ? "Best avoided" : e.maxServings == null ? "n/a" : e.maxServings === 0 ? "None" : `${e.maxServings} serving${e.maxServings === 1 ? "" : "s"}`}
              </dd>
              <dd className="text-[11px] text-ink-faint">
                {verdict === "AVOID" && e.maxServings ? `Within limits: ${e.maxServings} × ${e.perServing.grams} g, but not advised` : `1 serving = ${e.perServing.grams} g`}
              </dd>
            </div>
            <div className="bg-white p-4">
              <dt className="text-xs text-ink-soft">Sugar per serving</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{e.sugarTsp ?? "n/a"} <span className="text-sm font-normal text-ink-soft">tsp</span></dd>
              <dd className="text-[11px] text-ink-faint">{e.perServing.kcal ?? "?"} kcal per serving</dd>
            </div>
          </dl>

          <div className="mt-5 flex gap-2">
            <button onClick={() => speak(a.summary_en, "en-IN")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-semibold text-ink hover:bg-muted">
              <Volume2 className="h-3.5 w-3.5" /> Listen
            </button>
            <button onClick={() => speak(a.summary_ta, "ta-IN")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-xs font-semibold text-ink hover:bg-muted">
              <Volume2 className="h-3.5 w-3.5" /> தமிழில் கேள்
            </button>
          </div>
        </div>
      </motion.aside>

      {/* details */}
      <div className="space-y-6">
        <Block title="Why, for you">
          <ul className="space-y-3">
            {a.reasons.map((r) => (
              <li key={r} className="flex gap-3 text-[14px] leading-relaxed text-ink">
                <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", t.bg)} />
                {r}
              </li>
            ))}
          </ul>
        </Block>

        {a.claim_checks.length > 0 && (
          <Block
            title="Label claims checked"
            aside={<span className={cn("text-sm font-medium", misleading.length ? "text-bad" : "text-good")}>{misleading.length} of {a.claim_checks.length} misleading</span>}
          >
            <ul className="divide-y divide-line">
              {a.claim_checks.map((c) => (
                <li key={c.claim} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  {c.verdict === "misleading" ? <Ban className="mt-0.5 h-4 w-4 shrink-0 text-bad" /> : c.verdict === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />}
                  <div className="text-sm">
                    <p className={cn("font-semibold", c.verdict === "misleading" ? "text-bad" : "text-ink")}>&ldquo;{c.claim}&rdquo;</p>
                    <p className="mt-0.5 leading-relaxed text-ink-soft">{c.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Block>
        )}

        <Block title="Ingredients" aside={<span className="text-sm text-ink-soft">{e.hiddenSugars.length} sugar source{e.hiddenSugars.length === 1 ? "" : "s"} · {e.flags.length} flagged</span>}>
          <p className="text-[14px] leading-loose text-ink-soft">
            {a.ingredients.map((ing, i) => {
              const f = flagged.get(ing);
              return (
                <span key={ing + i}>
                  <span
                    title={f?.note}
                    className={cn(
                      f?.category === "hidden_sugar" && "rounded bg-bad/10 px-1 font-semibold text-bad",
                      f && f.category !== "hidden_sugar" && "rounded bg-warn/10 px-1 font-medium text-warn",
                      !f && "text-ink",
                    )}
                  >
                    {ing}
                  </span>
                  {i < a.ingredients.length - 1 && ", "}
                </span>
              );
            })}
          </p>
          {e.flags.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13px] text-ink-soft">
              {e.flags.map((f, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{f.ingredient}</span> · {f.note}
                </li>
              ))}
            </ul>
          )}
        </Block>

        <div className="grid gap-6 sm:grid-cols-2">
          <Block title="Nutrition per 100 g">
            <dl className="divide-y divide-line text-sm">
              {nutrition.map(([k, v, u]) => (
                <div key={k} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="font-medium text-ink tabular-nums">{v == null ? "n/a" : `${v} ${u}`}</dd>
                </div>
              ))}
            </dl>
          </Block>
          <Block title="Freshness">
            <p className={cn("text-sm font-semibold", e.expiry.status === "expired" ? "text-bad" : e.expiry.status === "soon" ? "text-warn" : e.expiry.status === "ok" ? "text-good" : "text-ink-soft")}>
              {e.expiry.text}
            </p>
            {a.dates.mfg && <p className="mt-1 text-sm text-ink-soft">Manufactured {a.dates.mfg}</p>}
            {(a.tips.length > 0 || a.alternatives.length > 0) && (
              <div className="mt-6 border-t border-line pt-4">
                <p className="text-sm font-semibold text-ink">Better choices</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                  {[...a.tips, ...a.alternatives.map((x) => `Try ${x}`)].map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
              </div>
            )}
          </Block>
        </div>

        <p className="text-xs text-ink-faint">Guidance, not medical advice. Numbers come from the label; the verdict is checked against your profile and reports.</p>
      </div>
    </div>
  );
}
