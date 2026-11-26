// Shared helpers for SmartPack Edge Functions: CORS, auth, Gemini generate + embed with failover.
import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Client acting as the calling user (RLS applies) + the verified user. */
export async function userClient(req: Request): Promise<{ sb: SupabaseClient; user: User } | null> {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data } = await sb.auth.getUser();
  return data.user ? { sb, user: data.user } : null;
}

/** Service-role client: only for writes the user may not do directly (vectors), always scoped to a verified user id. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

type Job = "vision" | "reasoning" | "embed";
const KEY_ORDER: Record<Job, string[]> = {
  vision: ["GEMINI_KEY_VISION", "GEMINI_KEY_REASONING", "GEMINI_KEY_EMBED"],
  reasoning: ["GEMINI_KEY_REASONING", "GEMINI_KEY_VISION", "GEMINI_KEY_EMBED"],
  embed: ["GEMINI_KEY_EMBED", "GEMINI_KEY_VISION", "GEMINI_KEY_REASONING"],
};
const keysFor = (job: Job) => KEY_ORDER[job].map((k) => Deno.env.get(k)).filter((k): k is string => !!k);

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;

// Benchmarked on a lab report (26 Nov): flash-lite + minimal thinking 8 s, 3-flash + minimal 10 s (both 9/9 values
// correct); flash-latest was overloaded (503) / 28 s+. Order = fastest reliable first; flash-latest is the last resort.
type ModelCfg = { model: string; thinking: Record<string, unknown> };
const TIERS: Record<"fast" | "accurate", ModelCfg[]> = {
  fast: [
    { model: "gemini-flash-lite-latest", thinking: { thinkingLevel: "minimal" } },
    { model: "gemini-3-flash-preview", thinking: { thinkingLevel: "minimal" } },
    { model: "gemini-flash-latest", thinking: { thinkingLevel: "low" } },
  ],
  accurate: [
    { model: "gemini-3-flash-preview", thinking: { thinkingLevel: "minimal" } },
    { model: "gemini-flash-lite-latest", thinking: { thinkingLevel: "minimal" } },
    { model: "gemini-flash-latest", thinking: { thinkingLevel: "low" } },
  ],
};

/** Calls the first model/key that works. Retries on 503 (overloaded), 429 (rate limit) and 403 (key lacks access). */
async function callWithFailover(
  job: Job,
  models: string[],
  method: string,
  body: string | ((model: string) => string),
  timeoutMs = 40_000,
): Promise<unknown> {
  let last = "";
  for (const model of models) {
    for (const key of keysFor(job)) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/${model}:${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: typeof body === "function" ? body(model) : body,
          signal: AbortSignal.timeout(timeoutMs), // a stuck call must not eat the function's time budget
        });
      } catch {
        last = `Gemini timeout (${model})`;
        break; // slow model -> try the next model
      }
      if (res.ok) return await res.json();
      last = `Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 200)}`;
      if (![403, 429, 503].includes(res.status)) break; // e.g. 404 model gone -> next model
    }
  }
  throw new Error(last || "Gemini unavailable");
}

/** JSON-mode generation. `parts` may include inline_data (images / PDFs). */
export async function generateJson<T>(
  job: Job,
  system: string,
  parts: unknown[],
  opts: { fast?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const tier = TIERS[opts.fast ? "fast" : "accurate"];
  const thinkingFor = (model: string) => tier.find((c) => c.model === model)!.thinking;
  const out = (await callWithFailover(
    job,
    tier.map((c) => c.model),
    "generateContent",
    (model) =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: thinkingFor(model) },
      }),
    opts.timeoutMs ?? 40_000,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(text.replace(/^```json\s*|```$/g, "")) as T;
}

/** 768-dim embeddings (cosine), batched. */
export async function embed(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out = (await callWithFailover(
    "embed",
    [EMBED_MODEL],
    "batchEmbedContents",
    JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: t.slice(0, 8000) }] },
        taskType: task,
        outputDimensionality: EMBED_DIMS,
      })),
    }),
  )) as { embeddings: { values: number[] }[] };
  return out.embeddings.map((e) => e.values);
}

/** Top-k chunks from the user's own health documents/profile for a free-text query. */
export async function retrieveUserContext(sb: SupabaseClient, userId: string, query: string, k = 6) {
  try {
    const [q] = await embed([query], "RETRIEVAL_QUERY");
    const { data } = await sb.rpc("match_profile_chunks", { p_user_id: userId, query_embedding: JSON.stringify(q), match_count: k });
    return ((data ?? []) as { chunk_text: string; source: string; similarity: number }[]).filter((c) => c.similarity > 0.35);
  } catch {
    return []; // retrieval is an enhancement: never block a scan on it
  }
}
