"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, ImageUp, RotateCcw, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { finalVerdict, runEngine, type Analysis, type EngineResult } from "@/lib/engine";
import type { Rulebook } from "@/lib/health";
import { Button, FullPageSpinner } from "@/components/ui";
import { ease } from "@/components/motion";
import { ScanResult } from "@/components/ScanResult";

/** Resize to ≤1600px and re-encode as JPEG so uploads stay small and fast. */
async function toJpegBase64(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

const TIPS = ["Lay the packet flat", "Fill the frame with the label", "Avoid glare from lights"];

// Step 1 of the scan flow: capture or upload the label photo.
// The analysis pipeline (OCR → engine → personalised verdict) is wired up next.
export default function ScanPage() {
  const auth = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ a: Analysis; e: EngineResult; v: "SAFE" | "LIMIT" | "AVOID" } | null>(null);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth, router]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (auth.status !== "signed_in") return <FullPageSpinner />;
  const rulebook = (auth.profile?.rulebook as Rulebook | null) ?? null;
  const userId = auth.session.user.id;

  function pick(f: File | undefined) {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setFile(f);
    setResult(null);
    setErr(null);
  }

  async function analyse() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const image_base64 = await toJpegBase64(file);
      const { data, error } = await supabase().functions.invoke("analyse-label", {
        body: { image_base64, mime_type: "image/jpeg" },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const detail = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(detail?.error ?? error.message);
      }
      const a = data as Analysis;
      if (!a.readable) throw new Error("Couldn't read a food label in this photo. Try a closer, sharper shot of the ingredients.");
      a.ingredients ??= [];
      a.claim_checks ??= [];
      a.reasons ??= [];
      a.tips ??= [];
      a.alternatives ??= [];
      const e = runEngine(a, rulebook);
      const v = finalVerdict(a, e);
      setResult({ a, e, v });
      supabase()
        .from("scans")
        .insert({ user_id: userId, product_name: [a.product.brand, a.product.name].filter(Boolean).join(" ") || null, label_json: a, engine_json: e, verdict_json: { verdict: v, headline: a.headline }, verdict: v, score: Math.max(0, Math.min(100, Math.round(a.score))) })
        .then(() => {});
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-night text-white">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-8">
        <header className="flex items-center justify-between py-5">
          <Link href="/home" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm font-medium">Scan a label</span>
          <span className="w-16" />
        </header>

        {/* viewfinder */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease }}
          className="relative mt-2 aspect-[3/4] w-full overflow-hidden rounded-3xl bg-night-2 ring-1 ring-white/10"
        >
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.img
                key={preview}
                src={preview}
                alt="Label preview"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease }}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <motion.div key="empty" exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <Camera className="mx-auto h-10 w-10 text-white/25" />
                  <p className="mt-3 text-sm text-white/45">Point at the ingredients &amp; nutrition table</p>
                </div>
                {/* scanning beam */}
                <motion.div
                  aria-hidden
                  className="absolute inset-x-8 h-0.5 bg-lime shadow-[0_0_20px_6px_rgb(182_240_156/0.45)]"
                  animate={{ top: ["12%", "88%", "12%"] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* corner brackets */}
          {(["top-5 left-5 border-t-3 border-l-3 rounded-tl-xl", "top-5 right-5 border-t-3 border-r-3 rounded-tr-xl", "bottom-5 left-5 border-b-3 border-l-3 rounded-bl-xl", "bottom-5 right-5 border-b-3 border-r-3 rounded-br-xl"] as const).map((c, i) => (
            <motion.span
              key={c}
              aria-hidden
              className={`absolute h-10 w-10 border-lime ${c}`}
              animate={{ scale: [1, 0.9, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
            />
          ))}
        </motion.div>

        {!preview && (
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
            className="mt-5 flex flex-wrap justify-center gap-2"
          >
            {TIPS.map((t) => (
              <motion.li
                key={t}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60"
              >
                {t}
              </motion.li>
            ))}
          </motion.ul>
        )}

        <div className="mt-auto pt-6">
          <div className="grid grid-cols-2 gap-3">
            <motion.label
              whileTap={{ scale: 0.97 }}
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime text-sm font-semibold text-night hover:bg-white"
            >
              {preview ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {preview ? "Retake" : "Take photo"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </motion.label>
            <motion.label
              whileTap={{ scale: 0.97 }}
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-medium hover:bg-white/10"
            >
              <ImageUp className="h-4 w-4" /> Upload
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </motion.label>
          </div>

          <Button variant="light" className="mt-3 h-12 w-full" disabled={!file} loading={busy} onClick={analyse}>
            <Sparkles className="h-4 w-4" /> {busy ? "Reading label & checking your profile…" : "Analyse label"}
          </Button>
          {err && <p className="mt-3 rounded-xl bg-bad/20 px-3 py-2 text-sm text-red-200">{err}</p>}
        </div>

        {result && (
          <div className="mt-6">
            <ScanResult a={result.a} e={result.e} verdict={result.v} />
          </div>
        )}
      </div>
    </main>
  );
}
