"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileHeart, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/useAuth";
import { ACTIVITY_LABELS, ALLERGIES, CONDITIONS, DIET_RULES, DIET_TYPES, GOALS, ageFromDob, bmiCategory, type Activity, type Rulebook } from "@/lib/health";
import { AppShell, PageHeader, Section } from "@/components/AppShell";
import { Pill } from "@/components/ui";

const ALL = [...CONDITIONS, ...ALLERGIES, ...DIET_TYPES, ...DIET_RULES, ...GOALS];
const name = (id: string) => ALL.find((x) => x.id === id)?.label ?? id;

export default function ProfilePage() {
  return <AppShell>{({ session, profile }) => <AboutMe p={profile!} email={session.user.email ?? ""} provider={(session.user.app_metadata?.provider as string) ?? "email"} />}</AppShell>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-6 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function Chips({ ids, tone, empty }: { ids: string[]; tone?: "brand" | "neutral"; empty: string }) {
  if (!ids.length) return <span className="text-ink-faint">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((i) => (
        <Pill key={i} tone={tone}>
          {name(i)}
        </Pill>
      ))}
    </span>
  );
}

function AboutMe({ p, email, provider }: { p: Profile; email: string; provider: string }) {
  const rb = p.rulebook as Rulebook | null;
  const age = ageFromDob(p.dob);
  const cat = p.bmi ? bmiCategory(Number(p.bmi)) : null;
  const diet = p.diet_prefs.filter((d) => DIET_TYPES.some((t) => t.id === d));
  const dietRules = p.diet_prefs.filter((d) => DIET_RULES.some((t) => t.id === d));
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    supabase()
      .from("health_documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.user_id)
      .then(({ count }) => setDocCount(count ?? 0));
  }, [p.user_id]);

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard", label: "Dashboard" }}
        eyebrow="My health"
        title={
          <span className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-soft font-sans text-2xl font-semibold text-brand">{p.full_name.charAt(0).toUpperCase()}</span>
            {p.full_name}
          </span>
        }
        description={`${email} · signed in with ${provider === "google" ? "Google" : "email"}`}
        actions={
          <Link href="/onboarding" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
            <Pencil className="h-4 w-4" /> Edit profile
          </Link>
        }
      />

      <Section title="Personal details">
        <dl className="divide-y divide-line rounded-2xl border border-line bg-white">
          <Row label="Age">{age != null ? `${age} years` : "n/a"} <span className="text-ink-faint">· born {new Date(p.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></Row>
          <Row label="Gender">{p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "n/a"}</Row>
          <Row label="Height · weight">
            {p.height_cm} cm · {p.weight_kg} kg
          </Row>
          <Row label="BMI">
            {p.bmi ?? "n/a"} {cat && <Pill tone={cat.tone}>{cat.label}</Pill>}
          </Row>
          <Row label="Activity">{ACTIVITY_LABELS[p.activity_level as Activity] ?? p.activity_level}</Row>
        </dl>
      </Section>

      <Section title="Health">
        <dl className="divide-y divide-line rounded-2xl border border-line bg-white">
          <Row label="Conditions">
            <Chips ids={p.conditions} empty="None" />
          </Row>
          <Row label="Allergies">
            <Chips ids={p.allergies} empty="None" />
          </Row>
          <Row label="Diet">
            <Chips ids={[...diet, ...dietRules]} empty="Not set" />
          </Row>
          <Row label="Goals">
            <Chips ids={p.goals} tone="brand" empty="Not set" />
          </Row>
          <Row label="In your words">{p.health_text ? <span className="leading-relaxed">{p.health_text}</span> : <span className="text-ink-faint">Not added</span>}</Row>
          <Row label="Reports">
            <Link href="/documents" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
              <FileHeart className="h-4 w-4" /> {docCount == null ? "…" : `${docCount} document${docCount === 1 ? "" : "s"}`}
            </Link>
          </Row>
        </dl>
      </Section>

      {rb && (
        <Section title="Your daily limits">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            {[
              ["Calories", rb.daily_kcal, "kcal", `BMR ${p.bmr_kcal ?? "n/a"} kcal × activity`],
              ["Added sugar", rb.sugar_g_max, "g", rb.watch.includes("hidden_sugar") ? "strict: diabetes / sugar cut" : "WHO < 10% of energy"],
              ["Sodium", rb.sodium_mg_max, "mg", rb.watch.includes("sodium") ? "strict: BP / heart / low-salt" : "WHO < 2,000 mg"],
              ["Saturated fat", rb.sat_fat_g_max, "g", rb.watch.includes("saturated_fat") ? "strict: cholesterol / heart" : "< 10% of energy"],
            ].map(([l, v, u, why]) => (
              <div key={String(l)} className="bg-white p-5">
                <p className="text-[13px] text-ink-soft">{l}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
                  {Number(v).toLocaleString("en-IN")} <span className="text-sm font-normal text-ink-soft">{u}</span>
                </p>
                <p className="mt-1 text-xs text-ink-faint">{why}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">Limits are calculated from your profile and update when you edit it.</p>
        </Section>
      )}
    </>
  );
}
