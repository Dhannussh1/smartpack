// SmartPack chat assistant: answers food & diet questions personalised to the user's profile,
// daily limits, their own health reports (vector search) and their recent scans.
import { cors, generateJson, json, retrieveUserContext, userClient } from "../_shared/gemini.ts";

const SYSTEM = `You are SmartPack Assistant, a friendly, careful nutrition guide for Indian users.
You personalise every answer using: the user's PROFILE (conditions, allergies, diet, goals, daily limits),
EXCERPTS from their own health reports, and their RECENT SCANS.
Rules:
- Be concrete: grams, teaspoons, pieces, portions, Indian foods and brands where helpful.
- When a report value or condition matters, mention it (e.g. "with your HbA1c of 7.4%…").
- Respect allergies and diet type strictly (never suggest an allergen or non-veg to a vegetarian).
- Keep replies under 130 words, use short bullet points when listing.
- You are not a doctor: for medicines, symptoms or emergencies, advise consulting a doctor.
- If the question is unrelated to food, nutrition, health or the app, politely steer back.
Return ONLY JSON: {"reply": string, "reply_ta": string, "used_documents": boolean, "suggestions": string[]}
"reply_ta" is the same reply in simple Tamil. "suggestions": 2-3 short follow-up questions the user might ask next.`;

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await userClient(req);
  if (!ctx) return json({ error: "Not signed in" }, 401);
  const { sb, user } = ctx;
  try {
    const { messages } = (await req.json()) as { messages: Msg[] };
    const history = (messages ?? []).filter((m) => m?.content).slice(-10);
    const last = history.at(-1);
    if (!last || last.role !== "user" || last.content.length > 1500) return json({ error: "Send a message (max 1500 characters)" }, 400);

    const [{ data: profile }, { data: scans }] = await Promise.all([
      sb.from("profiles").select("full_name, dob, gender, bmi, conditions, allergies, diet_prefs, goals, health_text, rulebook").eq("user_id", user.id).maybeSingle(),
      sb.from("scans").select("product_name, verdict, score, label_json->nutrition_per_100g, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    const chunks = await retrieveUserContext(sb, user.id, `${last.content} ${(profile?.conditions ?? []).join(" ")} ${(profile?.goals ?? []).join(" ")}`, 6);

    const transcript = history.map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`).join("\n");
    const out = await generateJson<{ reply: string; reply_ta: string; used_documents: boolean; suggestions: string[] }>(
      "reasoning",
      SYSTEM,
      [
        {
          text: `PROFILE: ${JSON.stringify(profile)}
REPORT EXCERPTS (most relevant first):
${chunks.map((c, i) => `[${i + 1}] ${c.chunk_text}`).join("\n") || "(no reports uploaded)"}
RECENT SCANS: ${JSON.stringify(scans ?? [])}
TODAY: ${new Date().toISOString().slice(0, 10)}

CONVERSATION:
${transcript}

Reply to the last USER message.`,
        },
      ],
      { fast: true },
    );
    return json({ ...out, sources: chunks.map((c) => c.chunk_text) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});
