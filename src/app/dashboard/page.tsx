"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileHeart, ScanLine, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/useAuth";
import type { Rulebook } from "@/lib/health";
import { lastNDays, localDay, totalsFor, useIntake } from "@/lib/intake";
import { BP_RANGE, numericValue, refRangeFor } from "@/lib/labs";
import { AppShell, PageHeader, Section } from "@/components/AppShell";
import { BudgetMeter, DailyBars, LabRange, VerdictBar } from "@/components/charts";
import { VerdictBadge, type ScanRow } from "@/components/VerdictBadge";
import { cn } from "@/components/ui";

export default function DashboardPage() {
  return <AppShell>{({ session, profile }) => <Dashboard userId={session.user.id} p={profile!} />}</AppShell>;
}

type Lab = { value: unknown; unit?: string | null; status?: string | null };
type Doc = { file_name: string | null; created_at: string; extracted_json: { report_date?: string | null; lab_values?: Record<string, Lab> } | null };

const shortDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
const longDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

function Dashboard({ userId, p }: { userId: string; p: Profile }) {
  const rb = p.rulebook as Rulebook | null;
  const { rows, reload } = useIntake(userId, 7);
  const today = localDay();
  const days = useMemo(() => lastNDays(7), []);

  const totals = useMemo(() => totalsFor(rows ?? [], today), [rows, today]);
  const series = useMemo(
    () => ({
      sugar: days.map((d) => ({ day: longDay(d), label: shortDay(d), value: Math.round(totalsFor(rows ?? [], d).sugar_g * 10) / 10 })),
      sodium: days.map((d) => ({ day: longDay(d), label: shortDay(d), value: Math.round(totalsFor(rows ?? [], d).sodium_mg) })),
    }),
    [rows, days],
  );
  const todayRows = (rows ?? []).filter((r) => r.day === today);

  async function removeEntry(id: number) {
    await supabase().from("daily_intake").delete().eq("id", id);
    reload();
  }

  return (
    <>
      <PageHeader
        back={{ href: "/home", label: "Overview" }}
        eyebrow="My health"
        title="Your health at a glance"
        description="Today's budget, the last seven days, your lab values and what you've been scanning, all in one place."
        actions={
          <Link href="/profile" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink hover:border-ink-faint/60">
            <UserRound className="h-4 w-4" /> About me
          </Link>
        }
      />

      {/* today */}
      <Section
        title={`Today · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long" })}`}
        action={
          <Link href="/scan" className="text-sm font-medium text-brand hover:underline">
            Log food by scanning
          </Link>
        }
      >
        {rb ? (
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            <BudgetMeter label="Calories" used={totals.calories} limit={rb.daily_kcal} unit="kcal" />
            <BudgetMeter label="Added sugar" used={totals.sugar_g} limit={rb.sugar_g_max} unit="g" decimals={1} />
            <BudgetMeter label="Sodium" used={totals.sodium_mg} limit={rb.sodium_mg_max} unit="mg" />
            <BudgetMeter label="Saturated fat" used={totals.sat_fat_g} limit={rb.sat_fat_g_max} unit="g" decimals={1} />
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Complete your profile to see daily limits.</p>
        )}

        <div className="mt-4 rounded-2xl border border-line bg-white">
          <p className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Eaten today</p>
          {rows === null ? (
            <div className="h-16 animate-pulse bg-muted/50" />
          ) : todayRows.length === 0 ? (
            <p className="px-5 py-5 text-sm text-ink-soft">
              Nothing logged yet. After a scan, tap <span className="font-medium text-ink">I ate this</span> to add it here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {todayRows.map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                  <VerdictBadge v={(r.scans?.verdict as ScanRow["verdict"]) ?? null} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{r.scans?.product_name ?? "Scanned product"}</span>
                    <span className="block text-xs text-ink-faint tabular-nums">
                      {Number(r.servings)} serving{Number(r.servings) === 1 ? "" : "s"} · {Math.round(Number(r.calories))} kcal · {Number(r.sugar_g)} g sugar · {Math.round(Number(r.sodium_mg))} mg sodium
                    </span>
                  </span>
                  <button onClick={() => removeEntry(r.id)} className="rounded-lg p-2 text-ink-faint hover:bg-muted hover:text-bad" aria-label={`Remove ${r.scans?.product_name ?? "entry"}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* last 7 days */}
      {rb && (
        <Section title="Last 7 days">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { name: "Added sugar", unit: "g", data: series.sugar, limit: rb.sugar_g_max },
              { name: "Sodium", unit: "mg", data: series.sodium, limit: rb.sodium_mg_max },
            ].map((c) => (
              <div key={c.name} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold text-ink">{c.name} per day</p>
                  <p className="text-xs text-ink-faint">
                    {c.unit} · dashed line = your limit
                  </p>
                </div>
                <div className="mt-3">
                  <DailyBars data={c.data} limit={c.limit} unit={c.unit} name={c.name} />
                </div>
                <details className="mt-2 text-xs text-ink-soft">
                  <summary className="cursor-pointer select-none hover:text-ink">View as table</summary>
                  <table className="mt-2 w-full tabular-nums">
                    <tbody>
                      {c.data.map((d) => (
                        <tr key={d.day} className="border-t border-line">
                          <td className="py-1">{d.day}</td>
                          <td className="py-1 text-right">
                            {d.value} {c.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <LabsPanel userId={userId} />
        </div>
        <div className="min-w-0">
          <ScansPanel userId={userId} />
        </div>
      </div>
    </>
  );
}

function LabsPanel({ userId }: { userId: string }) {
  const [doc, setDoc] = useState<Doc | null | undefined>(undefined);
  useEffect(() => {
    supabase()
      .from("health_documents")
      .select("file_name, created_at, extracted_json")
      .eq("user_id", userId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setDoc((data as Doc) ?? null));
  }, [userId]);

  const labs = Object.entries(doc?.extracted_json?.lab_values ?? {});
  const charted = labs
    .map(([name, l]) => {
      const isBp = /blood\s*pressure|^bp$/i.test(name);
      const range = isBp ? BP_RANGE : refRangeFor(name);
      const v = numericValue(name, l.value);
      return range && v != null ? { name: isBp ? `${name} (systolic)` : name, l, v, range } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const other = labs.filter(([name]) => !charted.some((c) => c.name.startsWith(name)));

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-ink">Lab values</h2>
        <Link href="/documents" className="text-sm font-medium text-brand hover:underline">
          Documents
        </Link>
      </div>
      {doc === undefined ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : !doc || labs.length === 0 ? (
        <Link href="/documents" className="flex min-h-56 flex-col justify-between rounded-2xl border border-dashed border-ink-faint/40 bg-white p-6 hover:border-brand">
          <FileHeart className="h-5 w-5 text-brand" />
          <div>
            <p className="font-semibold text-ink">No lab values yet</p>
            <p className="mt-1 text-sm text-ink-soft">Upload a checkup report to see each value against its normal range.</p>
            <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
              Upload report <ArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-6">
          <p className="mb-4 text-xs text-ink-faint">
            From {doc.file_name ?? "your report"}
            {doc.extracted_json?.report_date ? ` · ${doc.extracted_json.report_date}` : ""} · green band = typical normal range
          </p>
          <div className="divide-y divide-line">
            {charted.map((c) => (
              <LabRange key={c.name} name={c.name} value={c.v} display={String(c.l.value)} unit={c.l.unit} range={c.range} status={c.l.status} />
            ))}
          </div>
          {other.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-sm">
              {other.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                  <dt className="truncate text-ink-soft">{k}</dt>
                  <dd className={cn("shrink-0 font-semibold tabular-nums", v.status === "high" || v.status === "low" ? "text-bad" : "text-ink")}>{String(v.value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

function ScansPanel({ userId }: { userId: string }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  useEffect(() => {
    supabase()
      .from("scans")
      .select("id, product_name, verdict, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as ScanRow[]) ?? []));
  }, [userId]);

  const counts = { SAFE: 0, LIMIT: 0, AVOID: 0 };
  (rows ?? []).forEach((r) => r.verdict && (counts[r.verdict] += 1));
  const avg = rows?.length ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.length) : null;
  const risky = [...(rows ?? [])].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 4);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-ink">Your scans</h2>
        <Link href="/history" className="text-sm font-medium text-brand hover:underline">
          History
        </Link>
      </div>
      {!rows ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : rows.length === 0 ? (
        <Link href="/scan" className="flex min-h-56 flex-col justify-between rounded-2xl border border-dashed border-ink-faint/40 bg-white p-6 hover:border-brand">
          <ScanLine className="h-5 w-5 text-brand" />
          <div>
            <p className="font-semibold text-ink">No scans yet</p>
            <p className="mt-1 text-sm text-ink-soft">Scan a packet to start building your picture.</p>
          </div>
        </Link>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-ink-soft">Products checked</p>
              <p className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{rows.length}</p>
            </div>
            {avg != null && (
              <div className="text-right">
                <p className="text-xs text-ink-soft">Average score</p>
                <p className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
                  {avg}
                  <span className="text-sm font-normal text-ink-faint"> / 100</span>
                </p>
              </div>
            )}
          </div>
          <div className="mt-5">
            <VerdictBar counts={counts} />
          </div>
          <p className="mt-6 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">Lowest scores</p>
          <ul className="mt-2 divide-y divide-line">
            {risky.map((r) => (
              <li key={r.id}>
                <Link href={`/history?id=${r.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                  <VerdictBadge v={r.verdict} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.product_name ?? "Unnamed product"}</span>
                  <span className="text-sm text-ink-soft tabular-nums">{r.score}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
