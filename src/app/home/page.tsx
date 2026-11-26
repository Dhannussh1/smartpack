"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Bot, ChevronRight, Droplets, FileHeart, Flame, HeartPulse, Pencil, ScanLine, Soup } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/useAuth";
import { ALLERGIES, CONDITIONS, DIET_RULES, DIET_TYPES, GOALS, bmiCategory, type Rulebook } from "@/lib/health";
import { cn } from "@/components/ui";
import { CountUp, Item, Stagger } from "@/components/motion";
import { AppShell } from "@/components/AppShell";

const ALL_LABELS = [...CONDITIONS, ...GOALS, ...ALLERGIES, ...DIET_TYPES, ...DIET_RULES];
const label = (id: string) => ALL_LABELS.find((x) => x.id === id)?.label ?? id;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  return <AppShell>{({ profile }) => <Home p={profile!} />}</AppShell>;
}

function Home({ p }: { p: Profile }) {
  const rb = p.rulebook as Rulebook | null;
  const cat = p.bmi ? bmiCategory(p.bmi) : null;
  const first = p.full_name.split(" ")[0];

  const limits = rb
    ? [
        { icon: Flame, label: "Calories", value: rb.daily_kcal, unit: "kcal", hint: "daily need" },
        { icon: Droplets, label: "Added sugar", value: rb.sugar_g_max, unit: "g", hint: `≈ ${Math.round(rb.sugar_g_max / 4)} teaspoons`, key: "hidden_sugar" },
        { icon: Soup, label: "Sodium", value: rb.sodium_mg_max, unit: "mg", hint: `≈ ${(rb.sodium_mg_max / 400).toFixed(1)} g salt`, key: "sodium" },
        { icon: HeartPulse, label: "Saturated fat", value: rb.sat_fat_g_max, unit: "g", hint: "max per day", key: "saturated_fat" },
      ]
    : [];

  return (
    <>
      {/* greeting + scan CTA */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-dark p-6 text-white shadow-[0_20px_50px_-24px_rgb(15_138_95/0.9)]"
      >
        <div aria-hidden className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-lime/20 blur-2xl" />
        <p className="relative text-sm text-white/80">{greeting()},</p>
        <h1 className="relative mt-0.5 text-3xl font-semibold tracking-tight">{first} 👋</h1>
        <p className="relative mt-1 text-sm text-white/85">Every scan is checked against your profile and reports.</p>

        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="relative mt-5">
          <Link href="/scan" className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-ink shadow-lg">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <motion.span
                className="absolute inset-0 rounded-xl ring-2 ring-brand"
                animate={{ scale: [1, 1.3], opacity: [0.7, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <ScanLine className="h-6 w-6" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Scan a label</span>
              <span className="block text-sm text-ink-soft">Camera or photo of the packet</span>
            </span>
            <ArrowRight className="h-5 w-5 text-brand transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </motion.section>

      {/* limits */}
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Your daily limits</h2>
          <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        </div>
        <Stagger className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" gap={0.07} delay={0.2}>
          {limits.map((l) => {
            const watched = l.key && rb?.watch.includes(l.key);
            return (
              <Item key={l.label}>
                <div className={cn("relative h-full rounded-2xl border bg-white p-4", watched ? "border-bad/40" : "border-line")}>
                  {watched && <span className="absolute top-3 right-3 rounded-full bg-bad px-2 py-0.5 text-[10px] font-bold text-white">WATCH</span>}
                  <l.icon className={cn("h-5 w-5", watched ? "text-bad" : "text-brand")} />
                  <div className="mt-3 text-xs font-medium text-ink-soft">{l.label}</div>
                  <div className="mt-0.5 text-2xl font-semibold tracking-tight text-ink tabular-nums">
                    <CountUp value={l.value} /> <span className="text-sm font-normal text-ink-soft">{l.unit}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-soft">{l.hint}</div>
                </div>
              </Item>
            );
          })}
        </Stagger>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {cat && p.bmi && (
            <span className={cn("rounded-full px-3 py-1.5 font-semibold", cat.tone === "good" ? "bg-good/10 text-good" : cat.tone === "warn" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>
              BMI {p.bmi} · {cat.label}
            </span>
          )}
          {[...p.conditions, ...p.allergies, ...p.diet_prefs].map((c) => (
            <span key={c} className="rounded-full border border-line bg-white px-3 py-1.5 font-medium text-ink">{label(c)}</span>
          ))}
          {p.goals.map((g) => (
            <span key={g} className="rounded-full bg-brand-soft px-3 py-1.5 font-semibold text-brand-dark">{label(g)}</span>
          ))}
        </div>
      </section>

      <Link href="/assistant" className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-white p-5 transition-colors hover:border-brand/50">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">
          <Bot className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-ink">Ask the assistant</span>
          <span className="block text-sm text-ink-soft">&ldquo;What can I eat for a snack?&rdquo; Answers from your profile & reports</span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-faint" />
      </Link>

      <DocsCard userId={p.user_id} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Recent scans</h2>
        <RecentScans userId={p.user_id} />
      </section>
    </>
  );
}

function DocsCard({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<{ status: string; summary: string | null; extracted_json: { lab_values?: Record<string, { value: unknown; unit?: string; status?: string }> } | null }[] | null>(null);
  useEffect(() => {
    supabase()
      .from("health_documents")
      .select("status, summary, extracted_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs(data ?? []));
  }, [userId]);

  const latest = docs?.find((d) => d.status === "done");
  const labs = Object.entries(latest?.extracted_json?.lab_values ?? {}).slice(0, 4);

  return (
    <Link href="/documents" className="mt-8 block rounded-2xl border border-line bg-white p-5 transition-colors hover:border-brand/50">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft">
          <FileHeart className="h-5 w-5 text-brand" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-ink">My health documents</span>
          <span className="block text-sm text-ink-soft">
            {docs == null ? "Loading…" : docs.length === 0 ? "Upload a checkup report for sharper verdicts" : `${docs.length} uploaded · used in every scan`}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 text-ink-faint" />
      </div>
      {labs.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {labs.map(([k, v]) => (
            <div key={k} className={cn("rounded-xl px-3 py-2", v.status === "high" || v.status === "low" ? "bg-bad/8" : "bg-muted")}>
              <div className="truncate text-[11px] text-ink-soft">{k}</div>
              <div className={cn("text-sm font-semibold", v.status === "high" || v.status === "low" ? "text-bad" : "text-ink")}>
                {String(v.value)} <span className="text-[11px] font-normal text-ink-soft">{v.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

type ScanRow = { id: string; product_name: string | null; verdict: "SAFE" | "LIMIT" | "AVOID" | null; score: number | null; created_at: string };

function RecentScans({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  useEffect(() => {
    supabase()
      .from("scans")
      .select("id, product_name, verdict, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setRows((data as ScanRow[]) ?? []));
  }, [userId]);

  if (rows && rows.length > 0)
    return (
      <Stagger className="mt-3 space-y-2" gap={0.05}>
        {rows.map((r) => (
          <Item key={r.id}>
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
              <span className={cn("w-16 shrink-0 rounded-lg py-1 text-center text-[11px] font-bold text-white", r.verdict === "SAFE" ? "bg-good" : r.verdict === "LIMIT" ? "bg-warn" : "bg-bad")}>
                {r.verdict}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.product_name ?? "Unnamed product"}</span>
              <span className="text-sm text-ink-soft tabular-nums">{r.score}/100</span>
            </div>
          </Item>
        ))}
      </Stagger>
    );

  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted">
        <ScanLine className="h-6 w-6 text-ink-soft" />
      </span>
      <p className="mt-3 font-semibold text-ink">No scans yet</p>
      <p className="mt-1 text-sm text-ink-soft">{rows ? "Grab any packet from your kitchen and try it." : "Loading…"}</p>
    </div>
  );
}
