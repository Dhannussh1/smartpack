"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Eye, FileText, FileUp, Loader2, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppShell, PageHeader } from "@/components/AppShell";
import { cn } from "@/components/ui";

const MAX_MB = 10;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

type Lab = { value: unknown; unit?: string | null; status?: string | null };
type Doc = {
  id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  status: "uploaded" | "processing" | "done" | "failed";
  summary: string | null;
  error: string | null;
  extracted_json: { report_date?: string | null; lab_values?: Record<string, Lab>; diet_implications?: string[] } | null;
  created_at: string;
};

export default function DocumentsPage() {
  return <AppShell requireProfile={false}>{({ session }) => <Documents userId={session.user.id} />}</AppShell>;
}

/** Photos are shrunk to ≤1600 px JPEG before upload (faster upload + faster AI read). PDFs are sent as-is. */
async function shrinkIfImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** Starts AI extraction + vector indexing in the background; returns an error message or null. */
async function processDoc(id: string): Promise<string | null> {
  const { error } = await supabase().functions.invoke("process-document", { body: { document_id: id } });
  if (!error) return null;
  const ctx = (error as { context?: Response }).context;
  const detail = ctx ? await ctx.json().catch(() => null) : null;
  return detail?.error ?? error.message;
}

function Documents({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from("health_documents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
  }, [userId]);

  // while any document is being analysed, refresh every 2.5 s
  const analysing = docs?.some((d) => d.status === "processing") ?? false;
  useEffect(() => {
    if (!analysing) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [analysing, load]);

  useEffect(() => {
    let live = true;
    supabase()
      .from("health_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (live) setDocs((data as Doc[]) ?? []); });
    return () => { live = false; };
  }, [userId]);

  async function upload(original: File | undefined) {
    if (!original) return;
    setMsg(null);
    setUploading(true);
    const file = await shrinkIfImage(original);
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploading(false);
      return setMsg({ tone: "bad", text: `File must be under ${MAX_MB} MB.` });
    }
    const sb = supabase();
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const type = file.type || "application/octet-stream";
      const { error: uErr } = await sb.storage.from("health-docs").upload(path, file, { contentType: type });
      if (uErr) throw new Error(`Upload failed: ${uErr.message}`);
      const { data: row, error: dErr } = await sb
        .from("health_documents")
        .insert({ user_id: userId, file_path: path, file_name: file.name, mime_type: type, status: "processing" })
        .select()
        .single();
      if (dErr) throw new Error(`Saving record failed: ${dErr.message}`);
      await load();
      setUploading(false);
      const err = await processDoc(row.id); // returns in ~1 s; analysis continues in the background
      setMsg(err ? { tone: "bad", text: `Uploaded, but analysis couldn't start: ${err}` } : { tone: "ok", text: "Uploaded. Analysing in the background; this card updates by itself." });
      await load();
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Upload failed" });
      setUploading(false);
    }
  }

  async function view(d: Doc) {
    const { data, error } = await supabase().storage.from("health-docs").createSignedUrl(d.file_path, 120);
    if (error || !data) return setMsg({ tone: "bad", text: `Couldn't open file: ${error?.message}` });
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function reprocess(d: Doc) {
    setDocs((list) => list?.map((x) => (x.id === d.id ? { ...x, status: "processing" } : x)) ?? null);
    const err = await processDoc(d.id);
    if (err) setMsg({ tone: "bad", text: err });
    await load();
  }

  async function remove(d: Doc) {
    if (!confirm(`Delete "${d.file_name ?? "this document"}"? Its extracted values will no longer be used in scans.`)) return;
    const sb = supabase();
    await sb.storage.from("health-docs").remove([d.file_path]);
    const { error } = await sb.from("health_documents").delete().eq("id", d.id); // vectors are removed by cascade
    setMsg(error ? { tone: "bad", text: error.message } : { tone: "ok", text: "Document deleted." });
    await load();
  }

  return (
    <>
      <PageHeader
        eyebrow="My health"
        title="Health documents"
        description="Upload checkup reports. SmartPack reads the lab values and remembers them, so every scan and answer is checked against your real numbers."
      />

      <motion.label
        whileTap={{ scale: 0.995 }}
        className={cn(
          "mt-8 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-ink-faint/50 bg-white p-6 transition-colors hover:border-brand",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-ink">{uploading ? "Uploading…" : "Upload a new report"}</span>
          <span className="block text-sm text-ink-soft">PDF, JPG, PNG or WebP · up to {MAX_MB} MB</span>
        </span>
        <input type="file" accept={ACCEPT} className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </motion.label>

      <AnimatePresence>
        {msg && (
          <motion.p
            key={msg.text}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium", msg.tone === "ok" ? "bg-good/10 text-good" : "bg-bad/10 text-bad")}
          >
            {msg.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {msg.text}
          </motion.p>
        )}
      </AnimatePresence>

      <section className="mt-6 space-y-3">
        {docs == null && <p className="text-sm text-ink-soft">Loading…</p>}
        {docs?.length === 0 && (
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-2 font-semibold text-ink">No documents yet</p>
            <p className="text-sm text-ink-soft">Your first report makes every verdict sharper.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {docs?.map((d) => {
            const working = d.status === "processing";
            const labs = Object.entries(d.extracted_json?.lab_values ?? {});
            return (
              <motion.article
                key={d.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-2xl border border-line bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                    <FileText className="h-5 w-5 text-brand" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{d.file_name ?? "Report"}</p>
                    <p className="text-xs text-ink-soft">
                      Uploaded {new Date(d.created_at).toLocaleDateString()}
                      {d.extracted_json?.report_date ? ` · report date ${d.extracted_json.report_date}` : ""}
                    </p>
                  </div>
                  <StatusPill status={working ? "processing" : d.status} />
                </div>

                {working && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                    <Sparkles className="h-4 w-4 animate-pulse text-brand" /> Reading lab values and building your health memory (usually under 15 s)…
                  </p>
                )}
                {!working && d.status === "failed" && <p className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{d.error ?? "Analysis failed"}</p>}
                {!working && d.summary && <p className="mt-3 text-sm leading-relaxed text-ink">{d.summary}</p>}

                {!working && labs.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {labs.map(([k, v]) => {
                      const off = v.status === "high" || v.status === "low";
                      return (
                        <div key={k} className={cn("rounded-xl px-3 py-2", off ? "bg-bad/8" : v.status === "borderline" ? "bg-warn/10" : "bg-muted")}>
                          <div className="truncate text-[11px] text-ink-soft">{k}</div>
                          <div className={cn("text-sm font-semibold", off ? "text-bad" : "text-ink")}>
                            {String(v.value)} <span className="text-[11px] font-normal text-ink-soft">{v.unit}</span>
                            {v.status && v.status !== "normal" && <span className="ml-1 text-[10px] uppercase">{v.status}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionBtn onClick={() => view(d)} icon={Eye}>View</ActionBtn>
                  <ActionBtn onClick={() => reprocess(d)} icon={RefreshCw} disabled={working}>Re-analyse</ActionBtn>
                  <ActionBtn onClick={() => remove(d)} icon={Trash2} danger disabled={working}>Delete</ActionBtn>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </section>

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-white p-4 text-xs leading-relaxed text-ink-soft ring-1 ring-line">
        <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
        Stored in a private bucket only your account can open. Links to view a file expire after 2 minutes. Deleting a document also deletes everything extracted from it. Guidance, not medical advice.
      </p>
    </>
  );
}

function StatusPill({ status }: { status: Doc["status"] }) {
  const map = {
    done: ["bg-good/10 text-good", "Analysed"],
    processing: ["bg-brand-soft text-brand-dark", "Analysing…"],
    failed: ["bg-bad/10 text-bad", "Failed"],
    uploaded: ["bg-muted text-ink-soft", "Not analysed"],
  } as const;
  const [cls, text] = map[status];
  return <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>{text}</span>;
}

function ActionBtn({
  onClick,
  icon: Icon,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  icon: typeof Eye;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
        danger ? "border-bad/30 text-bad hover:bg-bad/5" : "border-line text-ink hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </motion.button>
  );
}
