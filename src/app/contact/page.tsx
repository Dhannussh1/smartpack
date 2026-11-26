"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Code2, MessageSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Button, Field, inputClass, cn } from "@/components/ui";

export default function ContactPage() {
  return <AppShell requireProfile={false}>{({ session }) => <Contact userId={session.user.id} email={session.user.email ?? ""} />}</AppShell>;
}

function Contact({ userId, email }: { userId: string; email: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase().from("feedback").insert({ user_id: userId, email, message: message.trim() });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setSent(true);
      setMessage("");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Contact us</h1>
      <p className="mt-1 text-sm text-ink-soft">Found a wrong verdict, a label we couldn&apos;t read, or have an idea? Tell the SmartPack team.</p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-5">
        <Field label="Your message" hint="Include the product name if it's about a scan.">
          <textarea
            required
            minLength={3}
            maxLength={4000}
            rows={5}
            value={message}
            onChange={(e) => { setMessage(e.target.value); setSent(false); }}
            className={cn(inputClass, "h-auto py-3 leading-relaxed")}
            placeholder="e.g. The Parle-G scan showed the wrong expiry date…"
          />
        </Field>
        {err && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
        {sent && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg bg-good/10 px-3 py-2 text-sm font-medium text-good">
            <CheckCircle2 className="h-4 w-4" /> Thanks! Your message reached the team.
          </motion.p>
        )}
        <Button type="submit" className="h-11 w-full" loading={busy}>
          <MessageSquare className="h-4 w-4" /> Send message
        </Button>
        <p className="text-xs text-ink-soft">We&apos;ll reply to {email || "your account email"}.</p>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href="https://github.com/Dhannussh1/smartpack" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 hover:border-brand/50">
          <Code2 className="h-5 w-5 text-ink" />
          <span>
            <span className="block text-sm font-semibold text-ink">Source code</span>
            <span className="block text-xs text-ink-soft">github.com/Dhannussh1/smartpack</span>
          </span>
        </a>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <ShieldCheck className="h-5 w-5 text-brand" />
          <span>
            <span className="block text-sm font-semibold text-ink">Your data</span>
            <span className="block text-xs text-ink-soft">Private to your account. Delete documents any time.</span>
          </span>
        </div>
      </div>
    </>
  );
}
