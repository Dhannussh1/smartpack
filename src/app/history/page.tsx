"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ScanLine, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Analysis, EngineResult } from "@/lib/engine";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ScanResult } from "@/components/ScanResult";
import { AskProduct } from "@/components/AskProduct";
import { IAteThis } from "@/components/IAteThis";
import type { Rulebook } from "@/lib/health";
import { VerdictBadge, type ScanRow } from "@/components/VerdictBadge";
import { cn, inputClass } from "@/components/ui";

type FullScan = ScanRow & { label_json: Analysis; engine_json: EngineResult };
const FILTERS = ["ALL", "SAFE", "LIMIT", "AVOID"] as const;

export default function HistoryPage() {
  return (
    <AppShell>
      {({ session, profile }) => (
        // useSearchParams needs a Suspense boundary in a static export
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <HistoryView userId={session.user.id} rulebook={(profile?.rulebook as Rulebook | null) ?? null} />
        </Suspense>
      )}
    </AppShell>
  );
}

function HistoryView({ userId, rulebook }: { userId: string; rulebook: Rulebook | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const openId = params.get("id");

  function open(id: string | null) {
    router.push(id ? `/history?id=${id}` : "/history");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return openId ? <Detail id={openId} userId={userId} rulebook={rulebook} onBack={() => open(null)} /> : <List userId={userId} onOpen={open} />;
}

function List({ userId, onOpen }: { userId: string; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase()
      .from("scans")
      .select("id, product_name, verdict, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as ScanRow[]) ?? []));
  }, [userId]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => (filter === "ALL" || r.verdict === filter) && (!q || (r.product_name ?? "").toLowerCase().includes(q.toLowerCase()))),
    [rows, filter, q],
  );
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (rows ?? []).filter((r) => f === "ALL" || r.verdict === f).length])), [rows]);

  return (
    <>
      <PageHeader back={{ href: "/home", label: "Overview" }} eyebrow="History" title="Every packet you've checked" description="Open any scan to see the full verdict again, or ask a follow-up question about it." />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap", filter === f ? "bg-ink text-white" : "text-ink-soft hover:text-ink")}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} <span className="opacity-60">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className={cn(inputClass, "pl-10")} />
        </label>
      </div>

      <div className="mt-6">
        {!rows && <div className="h-64 animate-pulse rounded-2xl bg-muted" />}
        {rows && rows.length === 0 && (
          <Link href="/scan" className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-faint/40 bg-white p-8 text-center hover:border-brand">
            <ScanLine className="h-6 w-6 text-ink-faint" />
            <p className="mt-3 font-semibold text-ink">No scans yet</p>
            <p className="mt-1 text-sm text-ink-soft">Your scanned packets will appear here.</p>
          </Link>
        )}
        {rows && rows.length > 0 && shown.length === 0 && <p className="py-12 text-center text-sm text-ink-soft">No scans match.</p>}
        {shown.length > 0 && (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {shown.map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/40">
                  <VerdictBadge v={r.verdict} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{r.product_name ?? "Unnamed product"}</span>
                    <span className="block text-xs text-ink-faint">
                      {new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-lg font-semibold text-ink tabular-nums">{r.score}</span>
                    <span className="block text-[10px] text-ink-faint">score</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Detail({ id, userId, rulebook, onBack }: { id: string; userId: string; rulebook: Rulebook | null; onBack: () => void }) {
  const [scan, setScan] = useState<FullScan | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    supabase()
      .from("scans")
      .select("id, product_name, verdict, score, created_at, label_json, engine_json")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setScan((data as FullScan) ?? null);
      });
    return () => {
      live = false;
    };
  }, [id]);

  return (
    <>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All scans
      </button>
      {scan === undefined && <div className="mt-6 h-96 animate-pulse rounded-2xl bg-muted" />}
      {scan === null && <p className="mt-6 text-sm text-ink-soft">This scan could not be found.</p>}
      {scan && (
        <>
          <p className="mt-6 text-xs text-ink-faint">
            Scanned {new Date(scan.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="mt-4">
            <ScanResult
              a={{ ...scan.label_json, ingredients: scan.label_json.ingredients ?? [], claim_checks: scan.label_json.claim_checks ?? [], reasons: scan.label_json.reasons ?? [], tips: scan.label_json.tips ?? [], alternatives: scan.label_json.alternatives ?? [] }}
              e={scan.engine_json}
              verdict={(scan.verdict ?? "LIMIT") as "SAFE" | "LIMIT" | "AVOID"}
            />
          </div>
          <div className="mt-8 space-y-8">
            <IAteThis
              userId={userId}
              scanId={scan.id}
              a={scan.label_json}
              e={scan.engine_json}
              verdict={(scan.verdict ?? "LIMIT") as "SAFE" | "LIMIT" | "AVOID"}
              rulebook={rulebook}
            />
            <AskProduct label={{ ...scan.label_json, verdict: scan.verdict }} />
          </div>
        </>
      )}
    </>
  );
}
