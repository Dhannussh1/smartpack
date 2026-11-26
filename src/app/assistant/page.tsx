"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, FileHeart, Send, Sparkles, Trash2, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { cn } from "@/components/ui";

type Meta = { reply_ta?: string; used_documents?: boolean; sources?: string[]; suggestions?: string[] };
type Msg = { id: number | string; role: "user" | "assistant"; content: string; meta?: Meta | null };

const STARTERS = [
  "What should I eat for an evening snack?",
  "Plan a breakfast that fits my limits",
  "Which biscuits are okay for me?",
  "How much sugar did my recent scans have?",
];

function speak(text: string, lang: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

export default function AssistantPage() {
  return <AppShell>{({ session, profile }) => <Chat userId={session.user.id} profile={profile} />}</AppShell>;
}

function Chat({ userId, profile }: { userId: string; profile: Profile | null }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const first = profile?.full_name.split(" ")[0] ?? "there";

  useEffect(() => {
    supabase()
      .from("chat_messages")
      .select("id, role, content, meta")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(60)
      .then(({ data }) => setMsgs((data as Msg[]) ?? []));
  }, [userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(content: string) {
    const q = content.trim();
    if (!q || busy || !msgs) return;
    setErr(null);
    setText("");
    const sb = supabase();
    const userMsg: Msg = { id: `u${crypto.randomUUID()}`, role: "user", content: q };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setBusy(true);
    sb.from("chat_messages").insert({ user_id: userId, role: "user", content: q }).then(() => {});

    const { data, error } = await sb.functions.invoke("chat", {
      body: { messages: next.slice(-10).map((m) => ({ role: m.role, content: m.content })) },
    });
    setBusy(false);
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const detail = ctx ? await ctx.json().catch(() => null) : null;
      setErr(detail?.error ?? error.message);
      return;
    }
    const meta: Meta = { reply_ta: data.reply_ta, used_documents: data.used_documents, sources: data.sources, suggestions: data.suggestions };
    setMsgs((m) => [...(m ?? []), { id: `a${crypto.randomUUID()}`, role: "assistant", content: data.reply, meta }]);
    sb.from("chat_messages").insert({ user_id: userId, role: "assistant", content: data.reply, meta }).then(() => {});
  }

  async function clear() {
    if (!confirm("Clear this conversation?")) return;
    await supabase().from("chat_messages").delete().eq("user_id", userId);
    setMsgs([]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  const lastAssistant = [...(msgs ?? [])].reverse().find((m) => m.role === "assistant");

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-3xl flex-col">
      <PageHeader
        eyebrow="Assistant"
        title={<span className="inline-flex items-center gap-3"><Bot className="h-8 w-8 text-brand" strokeWidth={1.6} /> Ask SmartPack</span>}
        description="Meals, snacks, swaps, portions: answers use your profile, your reports and your recent scans."
        actions={
          msgs && msgs.length > 0 ? (
            <button onClick={clear} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-soft hover:text-bad">
              <Trash2 className="h-4 w-4" /> Clear chat
            </button>
          ) : undefined
        }
      />

      <div className="mt-8 flex-1 space-y-4">
        {msgs?.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-white p-5">
            <p className="font-semibold text-ink">Hi {first} 👋</p>
            <p className="mt-1 text-sm text-ink-soft">I know your conditions, goals, daily limits and uploaded reports. Try one of these:</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-line px-3.5 py-3 text-left text-sm font-medium text-ink hover:border-brand hover:bg-brand-soft">
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {msgs?.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white shadow-sm">{m.content}</div>
              ) : (
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm">
                  <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                    <button onClick={() => speak(m.content, "en-IN")} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-ink">
                      <Volume2 className="h-3 w-3" /> English
                    </button>
                    {m.meta?.reply_ta && (
                      <button onClick={() => speak(m.meta!.reply_ta!, "ta-IN")} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-ink">
                        <Volume2 className="h-3 w-3" /> தமிழ்
                      </button>
                    )}
                    {m.meta?.used_documents && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                        <FileHeart className="h-3 w-3" /> Used your reports
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="flex gap-1 rounded-2xl border border-line bg-white px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-2 w-2 rounded-full bg-brand" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
              ))}
            </span>
            Checking your profile & reports…
          </motion.div>
        )}
        {err && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm font-medium text-bad">{err}</p>}
        <div ref={endRef} />
      </div>

      {/* sits above the mobile bottom tab bar; flush to the bottom on desktop */}
      <div className="sticky bottom-[68px] -mx-5 mt-4 border-t border-line bg-page/95 px-5 pt-3 pb-4 backdrop-blur sm:-mx-8 sm:px-8 lg:bottom-0 lg:mx-0 lg:rounded-t-2xl lg:border-x lg:px-5">
        {!busy && lastAssistant?.meta?.suggestions && lastAssistant.meta.suggestions.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {lastAssistant.meta.suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-brand">
                <Sparkles className="h-3 w-3 text-brand" /> {s}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            placeholder="Ask about any food, meal or product…"
            className="h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-brand/12"
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="submit"
            disabled={busy || !text.trim()}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-md disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </motion.button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-ink-soft">Guidance, not medical advice.</p>
      </div>
    </div>
  );
}
