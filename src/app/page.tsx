"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Camera, FileSearch, HeartPulse, Languages, ScanLine, ShieldAlert, UserRound } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { FullPageSpinner, Logo } from "@/components/ui";
import { Item, Stagger, ease } from "@/components/motion";
import { ScanDemo } from "@/components/ScanDemo";

const STEPS = [
  { icon: UserRound, title: "Tell us about you", text: "Age, weight, conditions, goals and, optionally, your checkup report." },
  { icon: Camera, title: "Scan any packet", text: "Photograph the label, even local brands with no barcode entry." },
  { icon: HeartPulse, title: "Get your verdict", text: "SAFE, LIMIT or AVOID, with exactly how much you can eat and why." },
];

const FEATURES = [
  { icon: ShieldAlert, title: "Hidden sugar hunter", text: "Maltodextrin, dextrose, invert syrup… 50+ disguises caught." },
  { icon: FileSearch, title: "Label Lie Detector", text: "“No added sugar”, “Multigrain”, “Natural”: checked against the real ingredients." },
  { icon: UserRound, title: "Knows your body", text: "Same packet, different verdict for a diabetic and a gym-goer." },
  { icon: Languages, title: "Speaks your language", text: "Verdicts read aloud in English and Tamil." },
];

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed_in") router.replace(auth.profile ? "/home" : "/onboarding");
  }, [auth, router]);

  if (auth.status !== "signed_out") return <FullPageSpinner />;

  return (
    <main>
      {/* ───────── dark hero ───────── */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <motion.div
          aria-hidden
          className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-brand/30 blur-[120px]"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative mx-auto max-w-6xl px-5">
          <header className="flex items-center justify-between py-5">
            <Logo light />
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">
              Sign in
            </Link>
          </header>

          <div className="grid items-center gap-16 pt-10 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-16 lg:pb-32">
            <Stagger gap={0.1}>
              <Item>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-lime">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
                  </span>
                  Your personal food-label guardian
                </span>
              </Item>
              <Item>
                <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
                  The label says <span className="text-white/50 line-through decoration-bad decoration-4">healthy</span>.
                  <br />
                  We tell you if it&apos;s <span className="bg-gradient-to-r from-lime to-emerald-300 bg-clip-text text-transparent">safe for you</span>.
                </h1>
              </Item>
              <Item>
                <p className="mt-6 max-w-lg text-lg text-white/65 text-pretty">
                  Point your phone at any packet. SmartPack reads the label like a nutritionist, uncovers hidden sugars,
                  catches misleading claims, and checks it all against <em className="text-white not-italic">your</em> health.
                </p>
              </Item>
              <Item className="mt-9 flex flex-wrap items-center gap-4">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/login"
                    className="group inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-6 font-semibold text-night shadow-[0_10px_40px_-10px_rgb(182_240_156/0.7)] transition hover:bg-white"
                  >
                    Scan your first packet
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>
                <span className="text-sm text-white/50">Free · takes 2 minutes</span>
              </Item>
            </Stagger>

            <div className="pb-6">
              <ScanDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ───────── how it works ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
          className="text-center text-3xl font-semibold tracking-tight"
        >
          Three steps. Zero nutrition degree.
        </motion.h2>
        <Stagger inView className="mt-12 grid gap-5 md:grid-cols-3" gap={0.12}>
          {STEPS.map((s, i) => (
            <Item key={s.title}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative h-full rounded-2xl border border-line bg-white p-6"
              >
                <span className="absolute top-5 right-6 text-5xl font-semibold text-muted">{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft">
                  <s.icon className="h-5 w-5 text-brand" />
                </span>
                <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{s.text}</p>
              </motion.div>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* ───────── features ───────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Stagger inView className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.08}>
            {FEATURES.map((f) => (
              <Item key={f.title}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="h-full rounded-2xl border border-line bg-page p-6"
                >
                  <f.icon className="h-6 w-6 text-brand" />
                  <h3 className="mt-4 font-medium">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft">{f.text}</p>
                </motion.div>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───────── final CTA ───────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="relative overflow-hidden rounded-3xl bg-night px-8 py-14 text-center text-white"
        >
          <div className="dot-grid absolute inset-0" aria-hidden />
          <div className="absolute -bottom-32 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-brand/40 blur-[100px]" aria-hidden />
          <ScanLine className="relative mx-auto h-8 w-8 text-lime" />
          <h2 className="relative mt-4 text-3xl font-semibold tracking-tight">Scan. Understand. Choose better.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/60">Food safety shouldn&apos;t need a nutrition degree.</p>
          <Link
            href="/login"
            className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-lime px-6 font-semibold text-night transition hover:bg-white"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="pb-10 text-center text-xs text-ink-faint">
        SmartPack gives guidance, not medical advice. Always follow your doctor.
      </footer>
    </main>
  );
}
