// Follow-up question about a scanned product, answered with the user's profile +
// the most relevant chunks from their own health documents (vector search).
import { cors, generateJson, json, retrieveUserContext, userClient } from "../_shared/gemini.ts";

const SYSTEM = `You are SmartPack, a careful nutrition assistant. Answer the user's question about the scanned product
using ONLY: the label data, their profile, and the excerpts from their own health documents.
Be specific with quantities (grams, pieces, teaspoons). Keep it under 90 words. If the documents mention a relevant lab value, cite it.
Not medical advice: for medication questions tell them to ask their doctor.
Return ONLY JSON: {"answer": string, "answer_ta": string, "used_documents": boolean}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await userClient(req);
  if (!ctx) return json({ error: "Not signed in" }, 401);
  const { sb, user } = ctx;
  try {
    const { question, label } = await req.json();
    if (!question || String(question).length > 500) return json({ error: "Ask a question (max 500 characters)" }, 400);

    const { data: profile } = await sb
      .from("profiles")
      .select("conditions, allergies, diet_prefs, goals, health_text, rulebook, bmi")
      .eq("user_id", user.id)
      .maybeSingle();
    const productName = [label?.product?.brand, label?.product?.name].filter(Boolean).join(" ");
    const chunks = await retrieveUserContext(sb, user.id, `${question} ${productName} ${(profile?.conditions ?? []).join(" ")}`);

    const out = await generateJson<{ answer: string; answer_ta: string; used_documents: boolean }>("reasoning", SYSTEM, [
      {
        text: `QUESTION: ${question}
LABEL: ${JSON.stringify({ product: label?.product, nutrition_per_100g: label?.nutrition_per_100g, ingredients: label?.ingredients, verdict: label?.verdict })}
PROFILE: ${JSON.stringify(profile)}
DOCUMENT EXCERPTS:
${chunks.map((c, i) => `[${i + 1}] ${c.chunk_text}`).join("\n") || "(none uploaded)"}`,
      },
    ], { fast: true });
    return json({ ...out, sources: chunks.map((c) => c.chunk_text) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
