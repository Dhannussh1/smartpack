"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, FileText, FileUp, ShieldCheck, X } from "lucide-react";
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
import { Button, Chips, Field, FullPageSpinner, Glow, Logo, cn, inputClass } from "@/components/ui";
import { CountUp, ease } from "@/components/motion";

const MAX_FILE_MB = 10;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const STEPS = [
  { title: "About you", sub: "We use this to calculate your daily calorie and nutrient limits." },
  { title: "Your health", sub: "This is what makes every scan personal to you." },
  { title: "Reports", sub: "Optional, but a recent checkup report makes verdicts far more precise." },
] as const;

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
  const [dir, setDir] = useState(1); // slide direction for step transitions
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

  function go(to: number) {
    setDir(to > step ? 1 : -1);
    setStep(to);
  }

  function next() {
    const err = validateStep(step);
    setError(err);
    if (!err) go(step + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < STEPS.length - 1) return next(); // Enter key on an earlier step = Continue
    for (let s = 0; s < STEPS.length; s++) {
      const err = validateStep(s);
      if (err) {
        go(s);
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
      if (pErr) throw new Error(`Saving profile failed: ${pErr.message}`);

      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
        const { error: uErr } = await sb.storage
          .from("health-docs")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (uErr) throw new Error(`Report upload failed: ${uErr.message}`);
        const { data: doc, error: dErr } = await sb
          .from("health_documents")
          .insert({ user_id: userId, file_path: path, file_name: file.name, mime_type: file.type || "application/octet-stream", status: "processing" })
          .select("id")
          .single();
        if (dErr) throw new Error(`Saving report record failed: ${dErr.message}`);
        // AI extraction + vector indexing runs in the background; progress shows on the Documents page
        sb.functions.invoke("process-document", { body: { document_id: doc.id } }).catch(() => {});
      }

      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while saving.");
      setSaving(false);
    }
  }

  const cat = bmiVal ? bmiCategory(bmiVal) : null;
  const typeHint = DIET_TYPES.find((t) => t.id === dietType);

  return (
    <main className="relative min-h-dvh">
      <Glow />
      <div className="mx-auto max-w-xl px-5 pb-20">
        <header className="flex items-center justify-between py-5">
          <Logo />
          <span className="flex items-center gap-3 text-sm text-ink-soft tabular-nums">
            {step + 1} / {STEPS.length}
            {existing && (
              <Link href="/home" className="rounded-lg border border-line bg-white px-3 py-1.5 font-medium text-ink hover:bg-muted">
                Cancel
              </Link>
            )}
          </span>
        </header>

        {/* stepper */}
        <ol className="mb-8 grid grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full bg-brand"
                  initial={false}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease }}
                />
              </div>
              <span className={cn("mt-2 flex items-center gap-1 text-xs", i <= step ? "font-medium text-ink" : "text-ink-faint")}>
                {i < step && <Check className="h-3 w-3 text-brand" strokeWidth={3} />}
                {s.title}
              </span>
            </li>
          ))}
        </ol>

        <form onSubmit={submit}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 40 * d }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: -40 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease }}
            >
              <h1 className="text-3xl font-semibold tracking-tight">{STEPS[step].title}</h1>
              <p className="mt-1.5 text-sm text-ink-soft">{STEPS[step].sub}</p>

              <div className="mt-7 space-y-6">
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
                        <input type="number" inputMode="decimal" className={inputClass} value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
                      </Field>
                      <Field label="Weight (kg)" required>
                        <input type="number" inputMode="decimal" className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="68" />
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

                    <AnimatePresence>
                      {bmiVal && metrics && cat && (
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 12 }}
                          transition={{ duration: 0.4, ease }}
                          className="grid grid-cols-3 overflow-hidden rounded-2xl bg-night text-center text-white"
                        >
                          <Metric label="BMI" sub={cat.label} tone={cat.tone}>
                            {bmiVal.toFixed(1)}
                          </Metric>
                          <Metric label="BMR" sub="kcal at rest">
                            <CountUp value={metrics.bmr} />
                          </Metric>
                          <Metric label="Daily need" sub="kcal / day" highlight>
                            <CountUp value={metrics.daily} />
                          </Metric>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Field label="Health conditions" group hint="Select any that apply. Leave empty if none.">
                      <Chips options={CONDITIONS} value={conditions} onChange={setConditions} />
                    </Field>
                    <Field label="Allergies / intolerances" group>
                      <Chips options={ALLERGIES} value={allergies} onChange={setAllergies} />
                    </Field>
                    <Field label="Diet type" required group hint="Pick one. We flag ingredients that don't fit your diet.">
                      <Chips options={DIET_TYPES} value={dietType ? [dietType] : []} onChange={(v) => setDietType(v.at(-1) ?? "")} />
                      <AnimatePresence mode="wait">
                        {typeHint && (
                          <motion.span
                            key={typeHint.id}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="mt-3 block rounded-xl border border-brand/20 bg-brand-soft px-3.5 py-2.5 text-xs leading-relaxed text-brand-dark"
                          >
                            <b>{typeHint.label}:</b> {typeHint.hint}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Field>
                    <Field label="Extra diet rules" group hint="Optional. Pick any that apply.">
                      <Chips options={DIET_RULES} value={dietRules} onChange={setDietRules} />
                      {dietRules.length > 0 && (
                        <span className="mt-3 block space-y-1 rounded-xl bg-muted px-3.5 py-2.5 text-xs text-ink-soft">
                          {DIET_RULES.filter((r) => dietRules.includes(r.id)).map((r) => (
                            <span key={r.id} className="block">
                              <b className="text-ink">{r.label}:</b> {r.hint}
                            </span>
                          ))}
                        </span>
                      )}
                    </Field>
                    <Field label="Current goal" required group>
                      <Chips options={GOALS} value={goals} onChange={setGoals} />
                    </Field>
                    <Field
                      label="Describe your health condition (optional)"
                      hint="E.g. “Type 2 diabetic for 3 years, on metformin. Trying to cut sugar and lose 5 kg. Get acidity with spicy food.”"
                    >
                      <textarea
                        rows={4}
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
                    <Field label="Health checkup report" group hint={`PDF or photo, up to ${MAX_FILE_MB} MB. Blood sugar, lipid profile, thyroid, etc.`}>
                      <AnimatePresence mode="wait" initial={false}>
                        {file ? (
                          <motion.div
                            key="file"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft px-4 py-4 text-sm"
                          >
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
                              <FileText className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-brand-dark">{file.name}</span>
                              <span className="text-xs text-brand-dark/70">{(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload</span>
                            </span>
                            <button type="button" onClick={() => setFile(null)} aria-label="Remove file" className="rounded-lg p-1.5 text-ink-soft hover:bg-white hover:text-ink">
                              <X className="h-4 w-4" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.label
                            key="drop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white px-4 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
                          >
                            <motion.span
                              className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft"
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <FileUp className="h-6 w-6 text-brand" />
                            </motion.span>
                            <span className="text-sm font-medium text-ink">Tap to upload a report</span>
                            <span className="text-xs text-ink-faint">PDF, JPG, PNG or WebP</span>
                            <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                          </motion.label>
                        )}
                      </AnimatePresence>
                    </Field>
                    <p className="flex items-start gap-2.5 rounded-xl bg-muted p-4 text-xs leading-relaxed text-ink-soft">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
                      Reports are stored in a private bucket that only your account can read. You can delete them any time.
                      SmartPack gives guidance, not medical advice.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 rounded-xl bg-bad/10 px-3.5 py-2.5 text-sm text-bad"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-12" onClick={() => { setError(null); go(step - 1); }}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              // distinct keys: React must not reuse the same <button> when it switches to type="submit",
              // otherwise the click that opens the last step also submits the form
              <Button key="continue" type="button" className="h-12 flex-1" onClick={next}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button key="submit" type="submit" className="h-12 flex-1" loading={saving}>
                {existing ? "Save profile" : "Finish setup"} <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function Metric({
  label,
  sub,
  tone,
  highlight,
  children,
}: {
  label: string;
  sub: string;
  tone?: "good" | "warn" | "bad";
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-3 py-4", highlight && "bg-brand")}>
      <div className="text-[11px] tracking-wide text-white/60 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{children}</div>
      <div
        className={cn(
          "text-xs",
          tone === "good" && "text-lime",
          tone === "warn" && "text-amber-300",
          tone === "bad" && "text-red-300",
          !tone && "text-white/60",
        )}
      >
        {sub}
      </div>
    </div>
  );
}
