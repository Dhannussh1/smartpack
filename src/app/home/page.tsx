"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Bot, FileHeart, ScanLine } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/useAuth";
import { ALLERGIES, CONDITIONS, DIET_RULES, DIET_TYPES, GOALS, bmiCategory, type Rulebook } from "@/lib/health";
import { Pill, cn } from "@/components/ui";
import { CountUp, Item, Stagger } from "@/components/motion";
import { AppShell, PageHeader, Section } from "@/components/AppShell";
import { VerdictBadge, type ScanRow } from "@/components/VerdictBadge";

const ALL_LABELS = [...CONDITIONS, ...GOALS, ...ALLERGIES, ...DIET_TYPES, ...DIET_RULES];
const label = (id: string) => ALL_LABELS.find((x) => x.id === id)?.label ?? id;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  return <AppShell>{({ profile }) => <Overview p={profile!} />}</AppShell>;
}

function Overview({ p }: { p: Profile }) {
  const rb = p.rulebook as Rulebook | null;
  const cat = p.bmi ? bmiCategory(p.bmi) : null;
  const first = p.full_name.split(" ")[0];

  const limits = rb
    ? [
        { label: "Calories", value: rb.daily_kcal, unit: "kcal", hint: "daily energy need" },
        { label: "Added sugar", value: rb.sugar_g_max, unit: "g", hint: `about ${Math.round(rb.sugar_g_max / 4)} teaspoons`, key: "hidden_sugar" },
        { label: "Sodium", value: rb.sodium_mg_max, unit: "mg", hint: `about ${(rb.sodium_mg_max / 400).toFixed(1)} g of salt`, key: "sodium" },
        { label: "Saturated fat", value: rb.sat_fat_g_max, unit: "g", hint: "maximum per day", key: "saturated_fat" },
      ]
    : [];

  const actions = [
    { href: "/scan", icon: ScanLine, title: "Scan a label", text: "Up to 4 photos of a packet", primary: true },
    { href: "/assistant", icon: Bot, title: "Ask the assistant", text: "Meals, snacks, swaps" },
    { href: "/documents", icon: FileHeart, title: "Add a report", text: "Lab values sharpen every verdict" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={
          <>
            {greeting()}, <span className="italic">{first}</span>.
          </>
        }
        description="Everything you scan is judged against your health profile and the reports you've uploaded."
      />

      <Stagger className="mt-8 grid gap-3 sm:grid-cols-3" gap={0.06}>
        {actions.map((a) => (
          <Item key={a.href}>
            <Link
              href={a.href}
              className={cn(
                "group flex h-full flex-col justify-between rounded-2xl border p-5 transition-colors",
                a.primary ? "border-brand bg-brand text-white hover:bg-brand-dark" : "border-line bg-white text-ink hover:border-ink-faint/50",
              )}
            >
              <div className="flex items-start justify-between">
                <a.icon className={cn("h-5 w-5", a.primary ? "text-white" : "text-brand")} strokeWidth={1.8} />
                <ArrowUpRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5", a.primary ? "text-white/70" : "text-ink-faint")} />
              </div>
              <div className="mt-8">
                <p className="font-semibold">{a.title}</p>
                <p className={cn("mt-0.5 text-sm", a.primary ? "text-white/75" : "text-ink-soft")}>{a.text}</p>
              </div>
            </Link>
          </Item>
        ))}
      </Stagger>

      <Section
        title="Your daily limits"
        action={
          <Link href="/onboarding" className="text-sm font-medium text-brand hover:underline">
            Edit profile
          </Link>
        }
      >
        {/* gap-px over a line-coloured background = hairline dividers at every breakpoint */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {limits.map((l) => {
            const watched = l.key && rb?.watch.includes(l.key);
            return (
              <div key={l.label} className="bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-ink-soft">{l.label}</span>
                  {watched && <Pill tone="bad">Watch</Pill>}
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  <CountUp value={l.value} />
                  <span className="ml-1 text-sm font-normal text-ink-soft">{l.unit}</span>
                </p>
                <p className="mt-1 text-xs text-ink-faint">{l.hint}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {cat && p.bmi && <Pill tone={cat.tone}>BMI {p.bmi} · {cat.label}</Pill>}
          {[...p.conditions, ...p.allergies, ...p.diet_prefs].map((c) => (
            <Pill key={c}>{label(c)}</Pill>
          ))}
          {p.goals.map((g) => (
            <Pill key={g} tone="brand">{label(g)}</Pill>
          ))}
        </div>
      </Section>

      <div className="mt-12 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="mb-4 flex items-end justify-between text-[15px] font-semibold text-ink">
            Recent scans
            <Link href="/history" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </h2>
          <RecentScans userId={p.user_id} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-[15px] font-semibold text-ink">Health snapshot</h2>
          <Snapshot userId={p.user_id} />
        </div>
      </div>
    </>
  );
}

type Lab = { value: unknown; unit?: string | null; status?: string | null };

function Snapshot({ userId }: { userId: string }) {
  const [state, setState] = useState<{ count: number; labs: [string, Lab][]; date?: string | null } | null>(null);
  useEffect(() => {
    supabase()
      .from("health_documents")
      .select("status, extracted_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const done = (data ?? []).find((d) => d.status === "done");
        const ej = done?.extracted_json as { lab_values?: Record<string, Lab>; report_date?: string | null } | undefined;
        setState({ count: data?.length ?? 0, labs: Object.entries(ej?.lab_values ?? {}).slice(0, 6), date: ej?.report_date });
      });
  }, [userId]);

  if (!state) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (state.labs.length === 0)
    return (
      <Link href="/documents" className="flex h-full min-h-48 flex-col justify-between rounded-2xl border border-dashed border-ink-faint/40 bg-white p-5 hover:border-brand">
        <FileHeart className="h-5 w-5 text-brand" strokeWidth={1.8} />
        <div>
          <p className="font-semibold text-ink">No lab values yet</p>
          <p className="mt-1 text-sm text-ink-soft">Upload a checkup report and SmartPack will quote your real numbers in every verdict.</p>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
            Upload report <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </div>
      </Link>
    );

  return (
    <div className="rounded-2xl border border-line bg-white">
      <ul className="divide-y divide-line">
        {state.labs.map(([k, v]) => {
          const off = v.status === "high" || v.status === "low";
          return (
            <li key={k} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="truncate text-sm text-ink-soft">{k}</span>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", off ? "text-bad" : "text-ink")}>
                {String(v.value)} <span className="font-normal text-ink-faint">{v.unit}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <Link href="/documents" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm font-medium text-brand hover:bg-muted/40">
        {state.count} document{state.count === 1 ? "" : "s"}{state.date ? ` · latest ${state.date}` : ""}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function RecentScans({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  useEffect(() => {
    supabase()
      .from("scans")
      .select("id, product_name, verdict, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRows((data as ScanRow[]) ?? []));
  }, [userId]);

  if (!rows) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (rows.length === 0)
    return (
      <Link href="/scan" className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-faint/40 bg-white p-8 text-center hover:border-brand">
        <ScanLine className="h-6 w-6 text-ink-faint" strokeWidth={1.8} />
        <p className="mt-3 font-semibold text-ink">No scans yet</p>
        <p className="mt-1 text-sm text-ink-soft">Grab any packet from your kitchen and try it.</p>
      </Link>
    );

  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/history?id=${r.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40">
            <VerdictBadge v={r.verdict} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{r.product_name ?? "Unnamed product"}</span>
              <span className="block text-xs text-ink-faint">{new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </span>
            <span className="text-sm text-ink-soft tabular-nums">{r.score}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
