"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileHeart, MessageCircleQuestion, Send, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, inputClass } from "./ui";

const SUGGESTIONS = ["Can I eat this after lunch?", "How many pieces are safe for me today?", "Is this okay with my cholesterol?"];

type Answer = { q: string; answer: string; answer_ta: string; used_documents: boolean; sources: string[] };

function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

/** Follow-up Q&A about a scanned product, grounded in the user's own health documents (vector search). */
export function AskProduct({ label }: { label: unknown }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  async function ask(question: string) {
    if (!question.trim()) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase().functions.invoke("ask-product", { body: { question, label } });
    setBusy(false);
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const detail = ctx ? await ctx.json().catch(() => null) : null;
      return setErr(detail?.error ?? error.message);
    }
    setAnswers((a) => [{ q: question, ...(data as Omit<Answer, "q">) }, ...a]);
    setQ("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(q);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <MessageCircleQuestion className="h-5 w-5 text-brand" /> Ask about this product
      </p>
      <p className="mt-0.5 text-xs text-ink-soft">Answers use your profile and your uploaded health reports.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:bg-brand-soft disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} className={inputClass} placeholder="Type your question…" />
        <button type="submit" disabled={busy || !q.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-50" aria-label="Ask">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {err && <p className="mt-2 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}

      <AnimatePresence initial={false}>
        {answers.map((a) => (
          <motion.div key={a.q + a.answer.slice(0, 10)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-muted p-4">
            <p className="text-xs font-semibold text-ink-soft">{a.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{a.answer}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => speak(a.answer, "en-IN")} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-ink ring-1 ring-line">
                <Volume2 className="h-3 w-3" /> English
              </button>
              <button onClick={() => speak(a.answer_ta, "ta-IN")} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-ink ring-1 ring-line">
                <Volume2 className="h-3 w-3" /> தமிழ்
              </button>
              <span className={cn("inline-flex items-center gap-1 text-[11px]", a.used_documents ? "text-brand" : "text-ink-faint")}>
                <FileHeart className="h-3 w-3" /> {a.used_documents ? `Based on ${a.sources.length} excerpts from your reports` : "No report data used"}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
