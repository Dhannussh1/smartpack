"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ImageUp } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { Button, Card, FullPageSpinner } from "@/components/ui";

// Step 1 of the scan flow: capture or upload the label photo.
// The analysis pipeline (OCR → engine → personalised verdict) is wired up next.
export default function ScanPage() {
  const auth = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
  }, [auth, router]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (auth.status !== "signed_in") return <FullPageSpinner />;

  function pick(f: File | undefined) {
    if (f) setPreview(URL.createObjectURL(f));
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16">
      <header className="py-5">
        <Link href="/home" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>
      <h1 className="text-2xl font-semibold tracking-tight">Scan a label</h1>
      <p className="mt-1 text-sm text-ink-soft">Photograph the ingredients list and nutrition table, flat and well lit.</p>

      <Card className="mt-6 p-0 overflow-hidden">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Label preview" className="max-h-[60vh] w-full object-contain bg-muted" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-muted text-ink-faint">
            <Camera className="h-10 w-10" />
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white hover:bg-brand-dark">
          <Camera className="h-4 w-4" /> Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-medium hover:bg-muted">
          <ImageUp className="h-4 w-4" /> Upload
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>

      <Button className="mt-4 w-full" disabled>
        Analyse label (coming next)
      </Button>
    </main>
  );
}
