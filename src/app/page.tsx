"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, ShieldAlert, UserRound, Languages } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { FullPageSpinner, Logo } from "@/components/ui";

const FEATURES = [
  { icon: ScanLine, title: "Reads the real label", text: "Ingredients, nutrition table and dates, straight from a photo, even for local brands." },
  { icon: ShieldAlert, title: "Catches hidden sugar", text: "Maltodextrin, dextrose, invert syrup… 50+ disguises flagged for you." },
  { icon: UserRound, title: "Knows your body", text: "Diabetic, on a sugar cut, or bulking: the same packet gets a different verdict." },
  { icon: Languages, title: "Speaks your language", text: "Verdicts read aloud in English, Tamil and Hindi." },
];

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed_in") router.replace(auth.profile ? "/home" : "/onboarding");
  }, [auth, router]);

  if (auth.status !== "signed_out") return <FullPageSpinner />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <Link href="/login" className="text-sm font-medium text-brand hover:text-brand-dark">
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <p className="mb-4 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-dark">
          Your personal food label guardian
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Point your phone at any packet. Know if it&apos;s safe <em className="not-italic text-brand">for you</em>.
        </h1>
        <p className="mt-5 max-w-xl text-ink-soft text-pretty">
          SmartPack reads the label like a nutritionist, checks it against your health profile, and tells you
          exactly how much you can eat, or why you shouldn&apos;t.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center rounded-xl bg-brand px-6 font-medium text-white transition hover:bg-brand-dark"
          >
            Get started, it&apos;s free
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-5">
              <f.icon className="h-5 w-5 text-brand" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-6 text-center text-xs text-ink-faint">
        SmartPack gives guidance, not medical advice. Always follow your doctor.
      </footer>
    </main>
  );
}
