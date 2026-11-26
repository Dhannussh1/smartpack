"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil, ScanLine } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { CONDITIONS, GOALS, bmiCategory, type Rulebook } from "@/lib/health";
import { Button, Card, FullPageSpinner, Logo, cn } from "@/components/ui";

const label = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

export default function Home() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
    if (auth.status === "signed_in" && !auth.profile) router.replace("/onboarding");
  }, [auth, router]);

  if (auth.status !== "signed_in" || !auth.profile) return <FullPageSpinner />;
  const p = auth.profile;
  const rb = p.rulebook as Rulebook | null;
  const cat = p.bmi ? bmiCategory(p.bmi) : null;
  const first = p.full_name.split(" ")[0];

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Button variant="ghost" className="h-9 px-3" onClick={() => supabase().auth.signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <h1 className="text-2xl font-semibold tracking-tight">Hi {first} 👋</h1>
      <p className="mt-1 text-sm text-ink-soft">Every scan is checked against your profile below.</p>

      <Link
        href="/scan"
        className="mt-6 flex items-center gap-4 rounded-2xl bg-brand p-5 text-white shadow-sm transition hover:bg-brand-dark"
      >
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15">
          <ScanLine className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-lg font-semibold">Scan a label</span>
          <span className="block text-sm text-white/80">Ingredients, nutrition table or front of pack</span>
        </span>
      </Link>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Your daily limits</h2>
          <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark">
            <Pencil className="h-3.5 w-3.5" /> Edit profile
          </Link>
        </div>
        {rb && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Limit label="Calories" value={rb.daily_kcal.toLocaleString()} unit="kcal" />
            <Limit label="Added sugar" value={String(rb.sugar_g_max)} unit="g" hint={`≈ ${Math.round(rb.sugar_g_max / 4)} tsp`} />
            <Limit label="Sodium" value={rb.sodium_mg_max.toLocaleString()} unit="mg" />
            <Limit label="Saturated fat" value={String(rb.sat_fat_g_max)} unit="g" />
          </dl>
        )}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {cat && p.bmi && (
            <span
              className={cn(
                "rounded-full px-2.5 py-1",
                cat.tone === "good" ? "bg-good/10 text-good" : cat.tone === "warn" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad",
              )}
            >
              BMI {p.bmi} · {cat.label}
            </span>
          )}
          {p.conditions.map((c) => (
            <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-ink-soft">
              {label(CONDITIONS, c)}
            </span>
          ))}
          {p.goals.map((g) => (
            <span key={g} className="rounded-full bg-brand-soft px-2.5 py-1 text-brand-dark">
              {label(GOALS, g)}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="font-medium">Recent scans</h2>
        <p className="mt-2 text-sm text-ink-soft">No scans yet. Try your first packet!</p>
      </Card>
    </main>
  );
}

function Limit({ label, value, unit, hint }: { label: string; value: string; unit: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value} <span className="text-xs font-normal text-ink-soft">{unit}</span>
      </dd>
      {hint && <dd className="text-xs text-ink-faint">{hint}</dd>}
    </div>
  );
}
