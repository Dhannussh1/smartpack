"use client";

// Chart primitives for the health dashboard.
// Specs (dataviz skill): thin marks with 4px rounded data-ends, recessive grid, one axis, hover tooltips,
// status colour always paired with a text label (amber is < 3:1 on white), text in ink tokens only.
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RefRange } from "@/lib/labs";
import { cn } from "./ui";

const C = { good: "var(--chart-good)", warn: "var(--chart-warn)", bad: "var(--chart-bad)", track: "var(--chart-track)" };

export type Tone = "good" | "warn" | "bad";
const TONE_LABEL: Record<Tone, string> = { good: "Within limit", warn: "Near limit", bad: "Over limit" };
const TONE_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: CircleAlert };

export function toneFor(used: number, limit: number): Tone {
  const r = limit > 0 ? used / limit : 0;
  return r > 1 ? "bad" : r >= 0.8 ? "warn" : "good";
}

/** Today's intake against a personal limit. */
export function BudgetMeter({ label, used, limit, unit, decimals = 0 }: { label: string; used: number; limit: number; unit: string; decimals?: number }) {
  const tone = toneFor(used, limit);
  const pct = limit > 0 ? Math.min(used / limit, 1.25) : 0;
  const Icon = TONE_ICON[tone];
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: decimals });
  return (
    <div className="bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-ink-soft">{label}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
          <Icon className="h-3.5 w-3.5" style={{ color: C[tone] }} aria-hidden />
          {TONE_LABEL[tone]}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {fmt(used)}
        <span className="text-sm font-normal text-ink-soft"> / {fmt(limit)} {unit}</span>
      </p>
      <div className="relative mt-3 h-2 rounded-full" style={{ background: C.track }} role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit} aria-label={`${label}: ${fmt(used)} of ${fmt(limit)} ${unit}`}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: C[tone] }}
          initial={{ width: 0 }}
          animate={{ width: `${(Math.min(pct, 1) * 100).toFixed(1)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* limit tick sits at 100% when the bar is capped */}
        <span className="absolute -top-1 -bottom-1 right-0 w-0.5 rounded-full bg-ink/40" aria-hidden />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {used > limit ? `${fmt(used - limit)} ${unit} over` : `${fmt(limit - used)} ${unit} left today`}
      </p>
    </div>
  );
}

/** A lab value on a track with the normal band shaded. */
export function LabRange({ name, value, display, unit, range, status }: { name: string; value: number; display: string; unit?: string | null; range: RefRange; status?: string | null }) {
  const span = range.max - range.min;
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - range.min) / span) * 100))}%`;
  const off = status === "high" || status === "low";
  const tone: Tone = off ? "bad" : status === "borderline" ? "warn" : "good";
  const Icon = TONE_ICON[tone];
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{name}</span>
        <span className="flex items-center gap-2 text-sm tabular-nums">
          <span className="font-semibold text-ink">{display}</span>
          {unit && <span className="text-xs text-ink-faint">{unit}</span>}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft">
            <Icon className="h-3.5 w-3.5" style={{ color: C[tone] }} aria-hidden />
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "n/a"}
          </span>
        </span>
      </div>
      <div className="relative mt-2.5 h-2 rounded-full" style={{ background: C.track }} aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-good/25" style={{ left: at(range.low), width: `calc(${at(range.high)} - ${at(range.low)})` }} />
        <motion.span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ background: C[tone] }}
          initial={{ left: "0%" }}
          animate={{ left: at(value) }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink-faint tabular-nums">
        <span>{range.min}</span>
        <span>normal {range.low === 0 ? `< ${range.high}` : `${range.low}–${range.high}`}</span>
        <span>{range.max}</span>
      </div>
    </div>
  );
}

type DayPoint = { day: string; label: string; value: number };

/** Daily totals for one nutrient with the personal limit drawn as a reference line. */
export function DailyBars({ data, limit, unit, name }: { data: DayPoint[]; limit: number; unit: string; name: string }) {
  const max = Math.max(limit * 1.25, ...data.map((d) => d.value)) || 1;
  return (
    <div className="h-52 w-full" role="img" aria-label={`${name} per day for the last ${data.length} days, limit ${limit} ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-ink-faint)" }} />
          <YAxis domain={[0, Math.ceil(max)]} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--chart-ink-faint)" }} />
          <Tooltip
            cursor={{ fill: "var(--chart-hover)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DayPoint;
              const tone = toneFor(p.value, limit);
              return (
                <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-ink">{p.day}</p>
                  <p className="mt-0.5 text-ink-soft tabular-nums">
                    {name}: <span className="font-semibold text-ink">{p.value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} {unit}</span> of {limit} · {TONE_LABEL[tone]}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine y={limit} stroke="var(--chart-ink-soft)" strokeDasharray="4 4" label={{ value: `limit ${limit}`, position: "insideTopRight", fontSize: 11, fill: "var(--chart-ink-soft)" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.day} fill={d.value === 0 ? "var(--chart-track)" : C[toneFor(d.value, limit)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** SAFE / LIMIT / AVOID share of all scans, labelled segments with 2px gaps. */
export function VerdictBar({ counts }: { counts: { SAFE: number; LIMIT: number; AVOID: number } }) {
  const total = counts.SAFE + counts.LIMIT + counts.AVOID;
  const parts = ([
    ["SAFE", "good"],
    ["LIMIT", "warn"],
    ["AVOID", "bad"],
  ] as const).filter(([k]) => counts[k] > 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`SAFE ${counts.SAFE}, LIMIT ${counts.LIMIT}, AVOID ${counts.AVOID}`}>
        {parts.map(([k, t]) => (
          <motion.div key={k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: C[t] }} initial={{ flexGrow: 0 }} animate={{ flexGrow: counts[k] }} transition={{ duration: 0.8 }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {([
          ["SAFE", "good", "Safe"],
          ["LIMIT", "warn", "Limit"],
          ["AVOID", "bad", "Avoid"],
        ] as const).map(([k, t, l]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: C[t] }} aria-hidden />
            <dt className="text-ink-soft">{l}</dt>
            <dd className={cn("ml-auto font-semibold text-ink tabular-nums sm:ml-0")}>{counts[k]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
