"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Aperture, Camera, CameraOff, ImageUp, RotateCcw, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { finalVerdict, runEngine, type Analysis, type EngineResult } from "@/lib/engine";
import type { Rulebook } from "@/lib/health";
import type { Profile } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui";
import { ease } from "@/components/motion";
import { ScanResult } from "@/components/ScanResult";
import { AskProduct } from "@/components/AskProduct";

/** Resize to ≤1600px and re-encode as JPEG so uploads stay small and fast. */
async function toJpegBase64(src: Blob): Promise<string> {
  const bmp = await createImageBitmap(src);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (!window.isSecureContext) return "Camera needs a secure page (https or localhost).";
  if (name === "NotAllowedError") return "Camera permission was blocked. Click the camera icon in the address bar → Allow, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device. Use Upload instead.";
  if (name === "NotReadableError") return "The camera is in use by another app (Zoom, Teams…). Close it and try again.";
  return "Couldn't start the camera. Use Upload instead.";
}

export default function ScanPage() {
  return <AppShell>{({ session, profile }) => <Scanner userId={session.user.id} profile={profile} />}</AppShell>;
}

function Scanner({ userId, profile }: { userId: string; profile: Profile | null }) {
  const rulebook = (profile?.rulebook as Rulebook | null) ?? null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ a: Analysis; e: EngineResult; v: "SAFE" | "LIMIT" | "AVOID" } | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  // stop the camera when leaving the page
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function startCamera() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setPreview(null);
      setBlob(null);
      setResult(null);
      setCamOn(true);
      // attach after the <video> mounts
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      setErr(cameraError(e));
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      setBlob(b);
      setPreview(URL.createObjectURL(b));
      stopCamera();
    }, "image/jpeg", 0.92);
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    stopCamera();
    setBlob(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setErr(null);
  }

  async function analyse() {
    if (!blob) return;
    setBusy(true);
    setErr(null);
    try {
      const image_base64 = await toJpegBase64(blob);
      const { data, error } = await supabase().functions.invoke("analyse-label", { body: { image_base64, mime_type: "image/jpeg" } });
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
      a.product ??= { name: null, brand: null, net_weight_g: null, serving_size_g: null, servings_per_pack: null, veg_mark: null };
      a.nutrition_per_100g ??= {};
      a.dates ??= { mfg: null, expiry: null, best_before_text: null };
      const e = runEngine(a, rulebook);
      const v = finalVerdict(a, e);
      setResult({ a, e, v });
      supabase()
        .from("scans")
        .insert({
          user_id: userId,
          product_name: [a.product.brand, a.product.name].filter(Boolean).join(" ") || null,
          label_json: a,
          engine_json: e,
          verdict_json: { verdict: v, headline: a.headline },
          verdict: v,
          score: Math.max(0, Math.min(100, Math.round(a.score))),
        })
        .then(() => {});
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Scan a label</h1>
      <p className="mt-1 text-sm text-ink-soft">Photograph the ingredients list and nutrition table, flat and well lit.</p>

      {/* viewfinder */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
        className="relative mt-5 aspect-[4/5] w-full overflow-hidden rounded-3xl bg-[#0b1712] shadow-lg sm:aspect-[4/3]"
      >
        {camOn && <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />}

        <AnimatePresence mode="wait">
          {!camOn && preview && (
            <motion.img
              key={preview}
              src={preview}
              alt="Captured label"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
          {!camOn && !preview && (
            <motion.div key="idle" exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <Camera className="mx-auto h-10 w-10 text-white/40" />
                <p className="mt-3 text-sm text-white/70">Tap <b className="text-white">Open camera</b> or <b className="text-white">Upload</b></p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(camOn || !preview) && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 h-0.5 bg-lime shadow-[0_0_20px_6px_rgb(182_240_156/0.45)]"
            animate={{ top: ["12%", "88%", "12%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {["top-4 left-4 border-t-4 border-l-4 rounded-tl-xl", "top-4 right-4 border-t-4 border-r-4 rounded-tr-xl", "bottom-4 left-4 border-b-4 border-l-4 rounded-bl-xl", "bottom-4 right-4 border-b-4 border-r-4 rounded-br-xl"].map((c) => (
          <span key={c} aria-hidden className={`pointer-events-none absolute h-10 w-10 border-lime ${c}`} />
        ))}

        {camOn && (
          <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-6">
            <button onClick={stopCamera} className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur" aria-label="Close camera">
              <X className="h-5 w-5" />
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={capture}
              className="grid h-18 w-18 place-items-center rounded-full border-4 border-white bg-white/25 backdrop-blur"
              aria-label="Capture photo"
            >
              <Aperture className="h-8 w-8 text-white" />
            </motion.button>
            <span className="w-11" />
          </div>
        )}
      </motion.div>

      {/* controls */}
      {!camOn && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startCamera}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-md hover:bg-brand-dark"
          >
            {preview ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {preview ? "Retake" : "Open camera"}
          </motion.button>
          <motion.label
            whileTap={{ scale: 0.97 }}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-ink hover:bg-muted"
          >
            <ImageUp className="h-4 w-4 text-brand" /> Upload photo
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          </motion.label>
        </div>
      )}

      {preview && !camOn && (
        <Button className="mt-3 h-12 w-full" loading={busy} onClick={analyse} disabled={busy}>
          <Sparkles className="h-4 w-4" /> {busy ? "Reading label & checking your health records…" : "Analyse label"}
        </Button>
      )}

      {err && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-bad/10 px-4 py-3 text-sm font-medium text-bad">
          <CameraOff className="mt-0.5 h-4 w-4 shrink-0" /> {err}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <ScanResult a={result.a} e={result.e} verdict={result.v} />
          <AskProduct label={{ ...result.a, verdict: result.v }} />
        </div>
      )}
    </>
  );
}
