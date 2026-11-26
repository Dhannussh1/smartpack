// SmartPack: photo of a food label + the user's health profile -> structured label + personalised verdict.
// Deterministic checks (aliases, quantity, dates) also run in the browser engine; the model explains.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest"; // 2.5-flash is closed to new API users

const SYSTEM = `You are SmartPack, a careful clinical-nutrition assistant for India.
You receive a photo of a packaged-food label and a user's health profile.
1) Extract the label faithfully. Never invent numbers: use null when a value is not visible.
2) Judge the product FOR THIS USER (conditions, goals, allergies, diet, personal daily limits).
3) Check every front-of-pack claim against the ingredients and nutrition table (e.g. "No added sugar" but maltodextrin present = misleading; "Multigrain" but refined wheat flour/maida first = misleading).
Return ONLY JSON matching this shape:
{
 "product": {"name": string|null, "brand": string|null, "net_weight_g": number|null, "serving_size_g": number|null, "servings_per_pack": number|null, "veg_mark": "veg"|"non_veg"|null},
 "nutrition_per_100g": {"energy_kcal": number|null, "protein_g": number|null, "carbs_g": number|null, "total_sugar_g": number|null, "added_sugar_g": number|null, "fat_g": number|null, "sat_fat_g": number|null, "trans_fat_g": number|null, "sodium_mg": number|null, "fibre_g": number|null},
 "ingredients": string[],
 "allergen_statement": string|null,
 "claims": string[],
 "dates": {"mfg": string|null, "expiry": string|null, "best_before_text": string|null},
 "claim_checks": [{"claim": string, "verdict": "ok"|"misleading"|"unverifiable", "reason": string}],
 "verdict": "SAFE"|"LIMIT"|"AVOID",
 "score": number,
 "headline": string,
 "reasons": string[],
 "tips": string[],
 "alternatives": string[],
 "summary_en": string,
 "summary_ta": string,
 "confidence": number,
 "readable": boolean
}
Rules: score 0-100 (100 = excellent for this user). headline <= 12 words, addressed to the user. reasons: 2-4 short bullets that reference the user's own condition/goal and the label numbers. summary_en: 2 sentences for text-to-speech. summary_ta: the same in simple Tamil. If the photo is not a food label or is unreadable, set readable=false.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return json({ error: "Not signed in" }, 401);

    const { image_base64, mime_type, images } = await req.json();
    const parts: unknown[] = [];
    const list: { image_base64: string; mime_type: string }[] = images ?? [{ image_base64, mime_type }];
    for (const im of list) parts.push({ inline_data: { mime_type: im.mime_type || "image/jpeg", data: im.image_base64 } });

    const { data: profile } = await sb.from("profiles").select("*").eq("user_id", u.user.id).maybeSingle();
    const { data: docs } = await sb.from("health_documents").select("extracted_json").eq("user_id", u.user.id).not("extracted_json", "is", null);
    const age = profile?.dob ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / 3.156e10) : null;
    const userCtx = {
      age,
      gender: profile?.gender,
      bmi: profile?.bmi,
      conditions: profile?.conditions,
      allergies: profile?.allergies,
      diet: profile?.diet_prefs,
      goals: profile?.goals,
      health_text: profile?.health_text,
      daily_limits: profile?.rulebook,
      lab_values: docs?.map((d) => d.extracted_json) ?? [],
    };
    parts.push({ text: `USER PROFILE:\n${JSON.stringify(userCtx)}\n\nToday's date: ${new Date().toISOString().slice(0, 10)}` });

    // Failover: overloaded (503) or rate-limited (429) -> next model / next key.
    const keys = ["GEMINI_KEY_VISION", "GEMINI_KEY_REASONING", "GEMINI_KEY_EMBED"]
      .map((k) => Deno.env.get(k))
      .filter((k): k is string => !!k);
    const models = [MODEL, "gemini-3-flash-preview", "gemini-flash-lite-latest"];
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      // low thinking keeps a scan to seconds instead of ~100 s
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
    });
    let res: Response | null = null;
    let lastErr = "";
    outer: for (const model of models) {
      for (const key of keys) {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body,
        });
        if (res.ok) break outer;
        lastErr = `Gemini ${res.status} (${model}): ${(await res.text()).slice(0, 200)}`;
        if (res.status !== 503 && res.status !== 429) break; // other errors: try next model
      }
    }
    if (!res?.ok) return json({ error: lastErr || "Gemini unavailable, please retry" }, 502);
    const out = await res.json();
    const text = out.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, ""));
    return json(parsed);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
