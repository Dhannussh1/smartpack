"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Droplets, Flame, HeartPulse, LogOut, Pencil, ScanLine, Soup } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { ALLERGIES, CONDITIONS, DIET_RULES, DIET_TYPES, GOALS, bmiCategory, type Rulebook } from "@/lib/health";
import { Button, FullPageSpinner, Logo, cn } from "@/components/ui";
import { CountUp, Item, Stagger } from "@/components/motion";

const ALL_LABELS = [...CONDITIONS, ...GOALS, ...ALLERGIES, ...DIET_TYPES, ...DIET_RULES];
const label = (id: string) => ALL_LABELS.find((x) => x.id === id)?.label ?? id;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

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

  const limits = rb
    ? [
        { icon: Flame, label: "Calories", value: rb.daily_kcal, unit: "kcal", hint: "daily need" },
        { icon: Droplets, label: "Added sugar", value: rb.sugar_g_max, unit: "g", hint: `≈ ${Math.round(rb.sugar_g_max / 4)} teaspoons`, key: "hidden_sugar" },
        { icon: Soup, label: "Sodium", value: rb.sodium_mg_max, unit: "mg", hint: `≈ ${(rb.sodium_mg_max / 400).toFixed(1)} g salt`, key: "sodium" },
        { icon: HeartPulse, label: "Saturated fat", value: rb.sat_fat_g_max, unit: "g", hint: "max per day", key: "saturated_fat" },
      ]
    : [];

  return (
    <main className="min-h-dvh pb-16">
      {/* dark header band */}
      <section className="relative overflow-hidden bg-night pb-24 text-white">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-brand/35 blur-[100px]" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-5">
          <header className="flex items-center justify-between py-5">
            <Logo light />
            <Button variant="ghost" className="h-9 px-3 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => supabase().auth.signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </header>
          <Stagger className="pt-6" gap={0.08}>
            <Item>
              <p className="text-sm text-white/55">{greeting()},</p>
            </Item>
            <Item>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight">{first} 👋</h1>
            </Item>
            <Item>
              <p className="mt-2 text-white/60">Every scan is checked against the profile below.</p>
            </Item>
          </Stagger>
        </div>
      </section>

      <div className="relative mx-auto -mt-16 max-w-3xl px-5">
        {/* scan CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.2 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
        >
          <Link
            href="/scan"
            className="group relative flex items-center gap-5 overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-[0_20px_50px_-20px_rgb(15_138_95/0.9)]"
          >
            {/* shine sweep */}
            <motion.span
              aria-hidden
              className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/15"
              animate={{ x: ["0%", "450%"] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
            />
            <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15">
              <motion.span
                className="absolute inset-0 rounded-2xl ring-2 ring-lime/70"
                animate={{ scale: [1, 1.25], opacity: [0.8, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <ScanLine className="h-8 w-8" />
            </span>
            <span className="relative flex-1">
              <span className="block text-xl font-semibold">Scan a label</span>
              <span className="mt-0.5 block text-sm text-white/75">Ingredients, nutrition table or front of pack</span>
            </span>
            <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* limits */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Your daily limits</h2>
            <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-brand hover:bg-brand-soft">
              <Pencil className="h-3.5 w-3.5" /> Edit profile
            </Link>
          </div>
          <Stagger className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" gap={0.07} delay={0.3}>
            {limits.map((l) => {
              const watched = l.key && rb?.watch.includes(l.key);
              return (
                <Item key={l.label}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    className={cn(
                      "relative h-full rounded-2xl border bg-white p-4",
                      watched ? "border-bad/30 ring-4 ring-bad/5" : "border-line",
                    )}
                  >
                    {watched && (
                      <span className="absolute top-3 right-3 rounded-full bg-bad/10 px-2 py-0.5 text-[10px] font-semibold text-bad">WATCH</span>
                    )}
                    <l.icon className={cn("h-5 w-5", watched ? "text-bad" : "text-brand")} />
                    <div className="mt-3 text-xs text-ink-soft">{l.label}</div>
                    <div className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                      <CountUp value={l.value} /> <span className="text-sm font-normal text-ink-soft">{l.unit}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faint">{l.hint}</div>
                  </motion.div>
                </Item>
              );
            })}
          </Stagger>
        </section>

        {/* profile tags */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 flex flex-wrap gap-2 text-xs"
        >
          {cat && p.bmi && (
            <span
              className={cn(
                "rounded-full px-3 py-1.5 font-medium",
                cat.tone === "good" ? "bg-good/10 text-good" : cat.tone === "warn" ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad",
              )}
            >
              BMI {p.bmi} · {cat.label}
            </span>
          )}
          {[...p.conditions, ...p.allergies].map((c) => (
            <span key={c} className="rounded-full border border-line bg-white px-3 py-1.5 text-ink-soft">
              {label(c)}
            </span>
          ))}
          {p.diet_prefs.map((d) => (
            <span key={d} className="rounded-full border border-line bg-white px-3 py-1.5 text-ink-soft">
              {label(d)}
            </span>
          ))}
          {p.goals.map((g) => (
            <span key={g} className="rounded-full bg-brand-soft px-3 py-1.5 font-medium text-brand-dark">
              {label(g)}
            </span>
          ))}
        </motion.section>

        {/* recent scans */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-10"
        >
          <h2 className="text-lg font-semibold tracking-tight">Recent scans</h2>
          <div className="mt-4 flex flex-col items-center rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted">
              <ScanLine className="h-6 w-6 text-ink-faint" />
            </span>
            <p className="mt-3 font-medium">No scans yet</p>
            <p className="mt-1 text-sm text-ink-soft">Grab any packet from your kitchen and try it.</p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
