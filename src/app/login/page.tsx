"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Droplets, FileSearch, HeartPulse } from "lucide-react";
import { appUrl, supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Button, Field, FullPageSpinner, Logo, inputClass } from "@/components/ui";
import { Item, Stagger, ease } from "@/components/motion";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const POINTS = [
  { icon: Droplets, text: "Finds sugar hiding under 50+ names" },
  { icon: FileSearch, text: "Catches misleading front-of-pack claims" },
  { icon: HeartPulse, text: "Verdicts tuned to your conditions & goals" },
];

export default function Login() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed_in") router.replace(auth.profile ? "/home" : "/onboarding");
  }, [auth, router]);

  async function google() {
    setError(null);
    setBusy("google");
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: appUrl("/auth/callback/") },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const sb = supabase();
    const { error } =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: appUrl("/auth/callback/") } });
    setBusy(null);
    if (error) setError(error.message);
  }

  if (auth.status !== "signed_out") return <FullPageSpinner />;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel */}
      <aside className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <motion.div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-[480px] w-[480px] rounded-full bg-brand/35 blur-[110px]"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <Link href="/" className="relative">
          <Logo light className="text-lg" />
        </Link>
        <Stagger className="relative mt-auto max-w-md" gap={0.12} delay={0.2}>
          <Item>
            <h2 className="text-4xl leading-tight font-semibold tracking-tight">
              Every packet, judged against <span className="text-lime">your</span> health.
            </h2>
          </Item>
          <div className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <Item key={p.text} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                <p.icon className="h-4 w-4 shrink-0 text-lime" />
                {p.text}
              </Item>
            ))}
          </div>
        </Stagger>
      </aside>

      {/* form */}
      <section className="relative grid place-items-center px-5 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <Link href="/" className="mb-10 flex justify-center lg:hidden">
            <Logo className="text-lg" />
          </Link>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, ease }}
            >
              <h1 className="text-2xl font-semibold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-1.5 text-sm text-ink-soft">
                {mode === "signin" ? "Sign in to scan with your health profile." : "Takes 2 minutes. Your data stays private."}
              </p>
            </motion.div>
          </AnimatePresence>

          <Button variant="outline" className="mt-8 h-12 w-full" onClick={google} loading={busy === "google"}>
            {busy !== "google" && <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto", x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit" className="h-12 w-full" loading={busy === "email"}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-brand hover:text-brand-dark"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </section>
    </main>
  );
}
