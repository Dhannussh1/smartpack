"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileUp, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "@/lib/useAuth";
import {
  ACTIVITY_LABELS,
  ALLERGIES,
  CONDITIONS,
  DIET_RULES,
  DIET_TYPES,
  GOALS,
  ageFromDob,
  baseRulebook,
  bmi as calcBmi,
  bmiCategory,
  bmr as calcBmr,
  dailyCalories,
  type Activity,
  type Gender,
} from "@/lib/health";
import { Button, Card, Chips, Field, FullPageSpinner, Logo, cn, inputClass } from "@/components/ui";

const MAX_FILE_MB = 10;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const STEPS = ["About you", "Your health", "Reports"] as const;

export default function OnboardingPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth, router]);

  if (auth.status !== "signed_in") return <FullPageSpinner />;
  return (
    <OnboardingForm
      userId={auth.session.user.id}
      defaultName={(auth.session.user.user_metadata?.full_name as string) ?? ""}
      existing={auth.profile}
    />
  );
}

function OnboardingForm({
  userId,
  defaultName,
  existing,
}: {
  userId: string;
  defaultName: string;
  existing: Profile | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(existing?.full_name ?? defaultName);
  const [dob, setDob] = useState(existing?.dob ?? "");
  const [gender, setGender] = useState<Gender>((existing?.gender as Gender) ?? "male");
  const [height, setHeight] = useState(existing ? String(existing.height_cm) : "");
  const [weight, setWeight] = useState(existing ? String(existing.weight_kg) : "");
  const [activity, setActivity] = useState<Activity>((existing?.activity_level as Activity) ?? "moderate");
  const [conditions, setConditions] = useState<string[]>(existing?.conditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(existing?.allergies ?? []);
  const [dietType, setDietType] = useState<string>(
    existing?.diet_prefs.find((d) => DIET_TYPES.some((t) => t.id === d)) ?? "",
  );
  const [dietRules, setDietRules] = useState<string[]>(
    existing?.diet_prefs.filter((d) => DIET_RULES.some((r) => r.id === d)) ?? [],
  );
  const diet = dietType ? [dietType, ...dietRules] : dietRules;
  const [goals, setGoals] = useState<string[]>(existing?.goals ?? []);
  const [healthText, setHealthText] = useState(existing?.health_text ?? "");
  const [file, setFile] = useState<File | null>(null);

  const age = ageFromDob(dob);
  const h = Number(height);
  const w = Number(weight);
  const bmiVal = calcBmi(h, w);

  const metrics = useMemo(() => {
    if (!age || !h || !w) return null;
    const b = calcBmr(gender, w, h, age);
    return { bmr: b, daily: dailyCalories(b, activity, goals) };
  }, [age, h, w, gender, activity, goals]);

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return "Please enter your name.";
      if (!age) return "Please enter a valid date of birth.";
      if (!(h >= 50 && h <= 250)) return "Height should be between 50 and 250 cm.";
      if (!(w >= 10 && w <= 300)) return "Weight should be between 10 and 300 kg.";
    }
    if (s === 1) {
      if (!dietType) return "Please choose your diet type.";
      if (goals.length === 0) return "Pick at least one goal (choose “Just eat healthier” if unsure).";
    }
    if (s === 2 && file && file.size > MAX_FILE_MB * 1024 * 1024) return `File must be under ${MAX_FILE_MB} MB.`;
    return null;
  }

  function next() {
    const err = validateStep(step);
    setError(err);
    if (!err) setStep(step + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) return next(); // Enter key on an earlier step = Continue
    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }
    if (!metrics || !bmiVal) return;
    setError(null);
    setSaving(true);
    const sb = supabase();

    try {
      const rulebook = baseRulebook({
        daily_kcal: metrics.daily,
        weight_kg: w,
        conditions,
        allergies,
        diet_prefs: diet,
        goals,
      });

      const { error: pErr } = await sb.from("profiles").upsert({
        user_id: userId,
        full_name: name.trim(),
        dob,
        gender,
        height_cm: h,
        weight_kg: w,
        activity_level: activity,
        conditions,
        allergies,
        diet_prefs: diet,
        goals,
        health_text: healthText.trim(),
        bmi: bmiVal,
        bmr_kcal: metrics.bmr,
        daily_kcal: metrics.daily,
        rulebook,
        processing_status: "pending",
        onboarded_at: existing ? undefined : new Date().toISOString(),
      });
      if (pErr) throw pErr;

      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
        const { error: uErr } = await sb.storage.from("health-docs").upload(path, file, { contentType: file.type });
        if (uErr) throw uErr;
        const { error: dErr } = await sb
          .from("health_documents")
          .insert({ user_id: userId, file_path: path, file_name: file.name, mime_type: file.type });
        if (dErr) throw dErr;
      }

      // Kick off AI processing (report extraction + embeddings). Fire-and-forget:
      // it is fine if the function is not deployed yet.
      sb.functions.invoke("process-profile", { body: {} }).catch(() => {});

      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while saving.");
      setSaving(false);
    }
  }

  const cat = bmiVal ? bmiCategory(bmiVal) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <span className="text-sm text-ink-soft">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      <div className="mb-6 flex gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
        ))}
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{STEPS[step]}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {step === 0 && "We use this to calculate your daily calorie and nutrient limits."}
        {step === 1 && "This is what makes every scan personal to you."}
        {step === 2 && "Optional, but a recent checkup report makes verdicts far more precise."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-5">
        {step === 0 && (
          <>
            <Field label="Full name" required>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of birth" required hint={age != null ? `Age: ${age} years` : undefined}>
                <input
                  type="date"
                  className={inputClass}
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                />
              </Field>
              <Field label="Gender" required>
                <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </Field>
              <Field label="Height (cm)" required>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                />
              </Field>
              <Field label="Weight (kg)" required>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="68"
                />
              </Field>
            </div>
            <Field label="Activity level" required>
              <select className={inputClass} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            {bmiVal && metrics && cat && (
              <Card className="grid grid-cols-3 gap-3 bg-muted p-4 text-center shadow-none">
                <Metric label="BMI" value={bmiVal.toFixed(1)} sub={cat.label} tone={cat.tone} />
                <Metric label="BMR" value={metrics.bmr.toLocaleString()} sub="kcal at rest" />
                <Metric label="Daily need" value={metrics.daily.toLocaleString()} sub="kcal / day" />
              </Card>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Health conditions" hint="Select any that apply. Leave empty if none.">
              <Chips options={CONDITIONS} value={conditions} onChange={setConditions} />
            </Field>
            <Field label="Allergies / intolerances">
              <Chips options={ALLERGIES} value={allergies} onChange={setAllergies} />
            </Field>
            <Field label="Diet type" required hint="Pick one. We flag ingredients that don't fit your diet.">
              <Chips options={DIET_TYPES} value={dietType ? [dietType] : []} onChange={(v) => setDietType(v.at(-1) ?? "")} />
              {dietType && (
                <span className="mt-2 block rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-dark">
                  <b>{DIET_TYPES.find((t) => t.id === dietType)?.label}:</b>{" "}
                  {DIET_TYPES.find((t) => t.id === dietType)?.hint}
                </span>
              )}
            </Field>
            <Field label="Extra diet rules" hint="Optional. Pick any that apply.">
              <Chips options={DIET_RULES} value={dietRules} onChange={setDietRules} />
              {dietRules.length > 0 && (
                <span className="mt-2 block space-y-1 rounded-lg bg-muted px-3 py-2 text-xs text-ink-soft">
                  {DIET_RULES.filter((r) => dietRules.includes(r.id)).map((r) => (
                    <span key={r.id} className="block">
                      <b className="text-ink">{r.label}:</b> {r.hint}
                    </span>
                  ))}
                </span>
              )}
            </Field>
            <Field label="Current goal" required>
              <Chips options={GOALS} value={goals} onChange={setGoals} />
            </Field>
            <Field
              label="Describe your health condition (optional)"
              hint="E.g. “Type 2 diabetic for 3 years, on metformin. Trying to cut sugar and lose 5 kg. Get acidity with spicy food.”"
            >
              <textarea
                rows={5}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                value={healthText}
                onChange={(e) => setHealthText(e.target.value)}
                placeholder="Tell us anything a nutritionist should know…"
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Health checkup report" hint={`PDF or photo, up to ${MAX_FILE_MB} MB. Blood sugar, lipid profile, etc.`}>
              {file ? (
                <div className="flex items-center justify-between rounded-xl border border-brand bg-brand-soft px-4 py-3 text-sm">
                  <span className="truncate font-medium text-brand-dark">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="text-ink-soft hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-white px-4 py-8 text-center text-sm text-ink-soft transition hover:border-brand">
                  <FileUp className="h-6 w-6 text-brand" />
                  Tap to upload a report
                  <input
                    type="file"
                    accept={ACCEPT}
                    className="sr-only"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </span>
              )}
            </Field>
            <p className="flex items-start gap-2 rounded-xl bg-muted p-4 text-xs leading-relaxed text-ink-soft">
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
              Reports are stored in a private, encrypted bucket that only your account can read. You can delete them
              any time. SmartPack gives guidance, not medical advice.
            </p>
          </>
        )}

        {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => { setError(null); setStep(step - 1); }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            // distinct keys: React must not reuse the same <button> when it switches to type="submit",
            // otherwise the click that opens the last step also submits the form
            <Button key="continue" type="button" className="flex-1" onClick={next}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button key="submit" type="submit" className="flex-1" loading={saving}>
              {existing ? "Save profile" : "Finish setup"}
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      <div
        className={cn(
          "text-xs",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          !tone && "text-ink-soft",
        )}
      >
        {sub}
      </div>
    </div>
  );
}
