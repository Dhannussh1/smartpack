import { cn } from "./ui";

export type Verdict = "SAFE" | "LIMIT" | "AVOID" | null;
export type ScanRow = { id: string; product_name: string | null; verdict: Verdict; score: number | null; created_at: string };

export function VerdictBadge({ v, className }: { v: Verdict; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-16 shrink-0 justify-center rounded-md py-1 text-[11px] font-bold tracking-wide",
        v === "SAFE" ? "bg-good/10 text-good" : v === "LIMIT" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad",
        className,
      )}
    >
      {v}
    </span>
  );
}
