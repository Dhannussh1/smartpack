// Reads a user's uploaded health report (PDF/image), extracts lab values + findings with Gemini,
// stores a summary, and indexes the findings as vectors (pgvector, HNSW) for retrieval at scan time.
// Responds immediately (202) and finishes in the background; the client watches health_documents.status.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { adminClient, cors, embed, generateJson, json, userClient } from "../_shared/gemini.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Short, structured output = fewer tokens = faster.
const SYSTEM = `You read medical checkup reports (Indian labs: blood sugar, HbA1c, lipid profile, thyroid, kidney, liver, CBC, vitamin D, BP).
Return ONLY JSON:
{"readable": boolean, "report_date": string|null, "summary": string,
 "lab_values": {"<test name>": {"value": number|string, "unit": string|null, "status": "low"|"normal"|"high"|"borderline"|null}},
 "findings": string[], "diet_implications": string[]}
summary: 2 plain-language sentences. findings: 4-8 short standalone sentences, each naming the test and value,
e.g. "HbA1c is 7.4% (high), indicating poorly controlled diabetes." diet_implications: 2-5 concrete food rules.
Never invent values; omit anything unreadable.`;

type Out = {
  readable: boolean;
  report_date: string | null;
  summary: string;
  lab_values: Record<string, unknown>;
  findings: string[];
  diet_implications: string[];
};

async function processDocument(sb: SupabaseClient, userId: string, doc: Record<string, string>) {
  const docId = doc.id;
  try {
    const { data: file, error: dlErr } = await sb.storage.from("health-docs").download(doc.file_path);
    if (dlErr || !file) throw new Error(`Could not read file: ${dlErr?.message}`);
    if (file.size > 15 * 1024 * 1024) throw new Error("File too large to analyse (max 15 MB)");
    const b64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    const mime = doc.mime_type || file.type || "application/pdf";

    const out = await generateJson<Out>(
      "reasoning",
      SYSTEM,
      [{ inline_data: { mime_type: mime, data: b64 } }, { text: "Extract this report." }],
      { fast: true, timeoutMs: 25_000 },
    );
    if (!out.readable) throw new Error("This doesn't look like a readable health report");

    const label = doc.file_name ?? "report";
    const chunks = [
      `Report summary (${label}${out.report_date ? `, ${out.report_date}` : ""}): ${out.summary}`,
      ...(out.findings ?? []),
      ...(out.diet_implications ?? []).map((d) => `Diet rule from report: ${d}`),
    ].filter((c) => c && c.trim().length > 5);

    const vectors = await embed(chunks, "RETRIEVAL_DOCUMENT");

    // replace this document's old vectors (re-processing never duplicates)
    const admin = adminClient();
    await admin.from("profile_embeddings").delete().eq("document_id", docId);
    const { error: insErr } = await admin.from("profile_embeddings").insert(
      chunks.map((chunk_text, i) => ({
        user_id: userId,
        document_id: docId,
        source: "report",
        chunk_text,
        embedding: JSON.stringify(vectors[i]),
      })),
    );
    if (insErr) throw new Error(`Saving vectors failed: ${insErr.message}`);

    await sb
      .from("health_documents")
      .update({
        status: "done",
        summary: out.summary,
        extracted_json: { report_date: out.report_date, lab_values: out.lab_values, diet_implications: out.diet_implications },
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", docId);
    return { ok: true, chunks: chunks.length, summary: out.summary, lab_values: out.lab_values };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("health_documents").update({ status: "failed", error: msg }).eq("id", docId);
    return { ok: false, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await userClient(req);
  if (!ctx) return json({ error: "Not signed in" }, 401);
  const { sb, user } = ctx;

  const { document_id, wait } = await req.json().catch(() => ({}));
  if (!document_id) return json({ error: "document_id required" }, 400);

  // RLS: this only returns the row if it belongs to the caller
  const { data: doc } = await sb.from("health_documents").select("*").eq("id", document_id).maybeSingle();
  if (!doc) return json({ error: "Document not found" }, 404);
  await sb.from("health_documents").update({ status: "processing", error: null }).eq("id", document_id);

  const work = processDocument(sb, user.id, doc);
  if (wait || typeof EdgeRuntime === "undefined") {
    const r = await work;
    return json(r, r.ok ? 200 : 500);
  }
  EdgeRuntime.waitUntil(work);
  return json({ queued: true }, 202);
});

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}
