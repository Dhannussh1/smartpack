"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Aperture, Camera, CameraOff, Check, ImagePlus, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { finalVerdict, runEngine, type Analysis, type EngineResult } from "@/lib/engine";
import type { Rulebook } from "@/lib/health";
import type { Profile } from "@/lib/useAuth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button, cn } from "@/components/ui";
import { ScanResult } from "@/components/ScanResult";
import { AskProduct } from "@/components/AskProduct";

const MAX_PHOTOS = 4;
const SLOT_HINTS = ["Ingredients", "Nutrition table", "Front of pack", "Dates / extra"];

type Photo = { id: string; blob: Blob; url: string };

// The Edge Function request must stay under ~1.5 MB (a 1.8 MB request failed in testing), so all photos
// share a total budget. Label text stays readable for Gemini down to ~900 px on the long side.
const TOTAL_BUDGET_B64 = 1_100_000;
const STEPS: [number, number][] = [
  [1600, 0.85],
  [1280, 0.8],
  [1100, 0.75],
  [960, 0.72],
  [860, 0.7],
];

/** Re-encode as JPEG, stepping size/quality down until the photo fits its share of the budget. */
async function toJpegBase64(src: Blob, budget: number): Promise<string> {
  const bmp = await createImageBitmap(src);
  const c = document.createElement("canvas");
  let out = "";
  for (const [max, q] of STEPS) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL("image/jpeg", q).split(",")[1];
    if (out.length <= budget) break;
  }
  return out;
}

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (!window.isSecureContext) return "Camera needs a secure page (https or localhost).";
  if (name === "NotAllowedError") return "Camera permission was blocked. Click the camera icon in the address bar → Allow, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device. Use “Add photos” instead.";
  if (name === "NotReadableError") return "The camera is in use by another app (Zoom, Teams…). Close it and try again.";
  return "Couldn't start the camera. Use “Add photos” instead.";
}

export default function ScanPage() {
  return <AppShell>{({ session, profile }) => <Scanner userId={session.user.id} profile={profile} />}</AppShell>;
}

function Scanner({ userId, profile }: { userId: string; profile: Profile | null }) {
  const rulebook = (profile?.rulebook as Rulebook | null) ?? null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urlsRef = useRef<string[]>([]);

  const [camOn, setCamOn] = useState(false);
  const [camReady, setCamReady] = useState(false); // shutter stays disabled until the feed has frames
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ a: Analysis; e: EngineResult; v: "SAFE" | "LIMIT" | "AVOID" } | null>(null);
  const [flash, setFlash] = useState(0);

  const full = photos.length >= MAX_PHOTOS;

  // release camera + object URLs when leaving the page
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function addBlobs(blobs: Blob[]) {
    setResult(null);
    setErr(null);
    setPhotos((cur) => {
      const room = MAX_PHOTOS - cur.length;
      const added = blobs.slice(0, room).map((blob) => {
        const url = URL.createObjectURL(blob);
        urlsRef.current.push(url);
        return { id: crypto.randomUUID(), blob, url };
      });
      if (blobs.length > room) setErr(`Only ${MAX_PHOTOS} photos per scan. Extra photos were skipped.`);
      return [...cur, ...added];
    });
  }

  function removePhoto(id: string) {
    setResult(null);
    setPhotos((cur) => cur.filter((p) => p.id !== id));
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
    setCamReady(false);
  }

  async function startCamera() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true); // the <video> mounts on this render; attachVideo connects the stream
    } catch (e) {
      setErr(cameraError(e));
    }
  }

  /** Ref callback: runs when the <video> element actually exists, so the stream is never attached to null. */
  function attachVideo(el: HTMLVideoElement | null) {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().then(() => setCamReady(true)).catch(() => {});
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || full) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setFlash((f) => f + 1);
    c.toBlob(
      (b) => {
        if (!b) return;
        addBlobs([b]);
        if (photos.length + 1 >= MAX_PHOTOS) stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  async function analyse() {
    if (photos.length === 0) return;
    stopCamera();
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const budget = Math.floor(TOTAL_BUDGET_B64 / photos.length);
      const images = await Promise.all(photos.map(async (p) => ({ image_base64: await toJpegBase64(p.blob, budget), mime_type: "image/jpeg" })));
      const { data, error } = await supabase().functions.invoke("analyse-label", { body: { images } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const detail = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(detail?.error ?? error.message);
      }
      const a = data as Analysis;
      if (!a.readable) throw new Error("Couldn't read a food label in these photos. Try closer, sharper shots of the ingredients and nutrition table.");
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
      requestAnimationFrame(() => document.getElementById("scan-result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      supabase()
        .from("scans")
        .insert({
          user_id: userId,
          product_name: [a.product.brand, a.product.name].filter(Boolean).join(" ") || null,
          label_json: a,
          engine_json: e,
          verdict_json: { verdict: v, headline: a.headline, photos: photos.length },
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

  function reset() {
    stopCamera();
    setPhotos([]);
    setResult(null);
    setErr(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Scan"
        title="Check a packet"
        description="Add up to four photos: the ingredients list, the nutrition table, the front of the pack and the dates. More angles give a more accurate verdict."
        actions={
          photos.length > 0 ? (
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Start over
            </Button>
          ) : undefined
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        {/* capture area */}
        <div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-night">
            {camOn ? (
              <>
                <video ref={attachVideo} playsInline muted onLoadedMetadata={() => setCamReady(true)} onPlaying={() => setCamReady(true)} className="absolute inset-0 h-full w-full object-cover" />
                <AnimatePresence>
                  {flash > 0 && (
                    <motion.div key={flash} className="absolute inset-0 bg-white" initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
                  )}
                </AnimatePresence>
                {["top-4 left-4 border-t-2 border-l-2 rounded-tl-lg", "top-4 right-4 border-t-2 border-r-2 rounded-tr-lg", "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-lg", "bottom-4 right-4 border-b-2 border-r-2 rounded-br-lg"].map((c) => (
                  <span key={c} aria-hidden className={`pointer-events-none absolute h-8 w-8 border-white/80 ${c}`} />
                ))}
                <div className="absolute inset-x-0 top-4 flex justify-center">
                  <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                    Photo {Math.min(photos.length + 1, MAX_PHOTOS)} of {MAX_PHOTOS} · {SLOT_HINTS[Math.min(photos.length, 3)]}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-8">
                  <button onClick={stopCamera} className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur" aria-label="Done with camera">
                    Done
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={capture}
                    disabled={full || !camReady}
                    className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-white/20 backdrop-blur disabled:opacity-40"
                    aria-label="Capture photo"
                  >
                    <Aperture className="h-7 w-7 text-white" />
                  </motion.button>
                  <span className="w-[62px]" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                  <Camera className="h-6 w-6 text-white" strokeWidth={1.6} />
                </span>
                <p className="mt-4 font-display text-2xl text-white">{photos.length ? `${photos.length} of ${MAX_PHOTOS} photos added` : "Ready when you are"}</p>
                <p className="mt-1 max-w-xs text-sm text-white/60">Lay the packet flat in good light. Fill the frame with the text.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="light" onClick={startCamera} disabled={full}>
                    <Camera className="h-4 w-4" /> Open camera
                  </Button>
                  <label className={cn("inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10", full && "pointer-events-none opacity-40")}>
                    <ImagePlus className="h-4 w-4" /> Add photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={full}
                      onChange={(e) => {
                        addBlobs(Array.from(e.target.files ?? []));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* photo tray */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
              const p = photos[i];
              return (
                <div key={p?.id ?? `slot-${i}`} className="relative aspect-square">
                  <AnimatePresence mode="popLayout">
                    {p ? (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 overflow-hidden rounded-xl border border-line bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removePhoto(p.id)}
                          className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                          aria-label={`Remove photo ${i + 1}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">{i + 1}</span>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-faint/40 text-center">
                        <Plus className="h-4 w-4 text-ink-faint" />
                        <span className="mt-1 px-1 text-[10px] leading-tight text-ink-faint">{SLOT_HINTS[i]}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* guidance + action */}
        <aside className="lg:pt-1">
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="text-[15px] font-semibold text-ink">What to photograph</p>
            <ol className="mt-4 space-y-3">
              {SLOT_HINTS.map((h, i) => {
                const done = i < photos.length;
                return (
                  <li key={h} className="flex items-center gap-3 text-sm">
                    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold", done ? "bg-brand text-white" : "bg-muted text-ink-soft")}>
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className={cn(done ? "text-ink" : "text-ink-soft")}>
                      {h}
                      {i === 0 && <span className="text-ink-faint">, most important</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 border-t border-line pt-6">
              <Button size="lg" className="w-full" onClick={analyse} loading={busy} disabled={photos.length === 0 || busy}>
                <Sparkles className="h-4 w-4" />
                {busy ? "Analysing…" : photos.length ? `Analyse ${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Add a photo to begin"}
              </Button>
              <p className="mt-3 text-center text-xs text-ink-faint">
                {busy ? "Reading the label and checking your health records, usually 10–20 s" : "Checked against your profile and uploaded reports"}
              </p>
            </div>
          </div>
          {err && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-bad/20 bg-bad/5 px-4 py-3 text-sm text-bad">
              <CameraOff className="mt-0.5 h-4 w-4 shrink-0" /> {err}
            </p>
          )}
        </aside>
      </div>

      {result && (
        <div id="scan-result" className="mt-12 scroll-mt-24 border-t border-line pt-12">
          <ScanResult a={result.a} e={result.e} verdict={result.v} />
          <div className="mt-8">
            <AskProduct label={{ ...result.a, verdict: result.v }} />
          </div>
        </div>
      )}
    </>
  );
}
