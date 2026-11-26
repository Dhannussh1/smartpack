// SmartPack: photo of a food label + the user's health profile + relevant excerpts from their own
// health documents (vector search) -> structured label + personalised verdict.
// Deterministic checks (aliases, quantity, dates, allergens) also run in the browser engine; the model explains.
import { cors, generateJson, json, retrieveUserContext, userClient } from "../_shared/gemini.ts";

const SYSTEM = `You are SmartPack, a careful clinical-nutrition assistant for India.
You receive a photo of a packaged-food label, a user's health profile, and excerpts from the user's own health reports.
1) Extract the label faithfully. Never invent numbers: use null when a value is not visible.
2) Judge the product FOR THIS USER (conditions, goals, allergies, diet, personal daily limits, lab values from their reports).
   When a report excerpt is relevant (e.g. HbA1c, LDL, BP), quote the value in a reason.
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
Rules: score 0-100 (100 = excellent for this user). headline <= 12 words, addressed to the user. reasons: 2-4 short bullets that reference the user's own condition/goal/lab value and the label numbers. summary_en: 2 sentences for text-to-speech. summary_ta: the same in simple Tamil. confidence 0-1. If the photo is not a food label or is unreadable, set readable=false.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await userClient(req);
  if (!ctx) return json({ error: "Not signed in" }, 401);
  const { sb, user } = ctx;
  try {
    const { image_base64, mime_type, images } = await req.json();
    const list: { image_base64: string; mime_type: string }[] = images ?? [{ image_base64, mime_type }];
    const parts: unknown[] = list.map((im) => ({ inline_data: { mime_type: im.mime_type || "image/jpeg", data: im.image_base64 } }));

    const { data: profile } = await sb.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    const { data: docs } = await sb
      .from("health_documents")
      .select("summary, extracted_json")
      .eq("user_id", user.id)
      .eq("status", "done");

    // RAG: the user's own report findings most relevant to their conditions & goals
    const query = [
      "food and diet restrictions",
      ...(profile?.conditions ?? []),
      ...(profile?.goals ?? []),
      profile?.health_text ?? "",
      "blood sugar cholesterol blood pressure lab values",
    ].join(" ");
    const chunks = await retrieveUserContext(sb, user.id, query, 6);

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
      lab_values: (docs ?? []).map((d) => d.extracted_json?.lab_values).filter(Boolean),
    };
    parts.push({
      text: `USER PROFILE:\n${JSON.stringify(userCtx)}\n\nEXCERPTS FROM USER'S HEALTH REPORTS (most relevant first):\n${
        chunks.map((c, i) => `[${i + 1}] ${c.chunk_text}`).join("\n") || "(none uploaded)"
      }\n\nToday's date: ${new Date().toISOString().slice(0, 10)}`,
    });

    const result = await generateJson<Record<string, unknown>>("vision", SYSTEM, parts);
    return json({ ...result, context_sources: chunks.map((c) => c.chunk_text) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
