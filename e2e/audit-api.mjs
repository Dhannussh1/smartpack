// Full pipeline audit through the live APIs (test account only). Prints a JSON report.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).replace(/^﻿/, "").trim(), l.slice(i + 1).trim()];
  }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: s } = await sb.auth.signInWithPassword({ email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
const uid = s.user.id;
const [reportImg, ...labelImgs] = process.argv.slice(2);
const R = {};
const err = async (e) => (e?.context && typeof e.context.text === "function" ? await e.context.text() : e?.message ?? String(e));
const timed = async (fn) => { const t = Date.now(); const r = await fn(); return [r, Date.now() - t]; };

// 1. report upload -> background processing -> vectors
const path = `${uid}/audit-report.jpg`;
await sb.storage.from("health-docs").remove([path]);
const up = await sb.storage.from("health-docs").upload(path, fs.readFileSync(reportImg), { contentType: "image/jpeg" });
const { data: doc } = await sb.from("health_documents").insert({ user_id: uid, file_path: path, file_name: "audit-report.jpg", mime_type: "image/jpeg", status: "processing" }).select().single();
const [pd, pdMs] = await timed(() => sb.functions.invoke("process-document", { body: { document_id: doc.id } }));
let row, t0 = Date.now();
do { await new Promise((r) => setTimeout(r, 1500)); ({ data: row } = await sb.from("health_documents").select("status, error, summary, extracted_json").eq("id", doc.id).single()); } while (row.status === "processing" && Date.now() - t0 < 90000);
const { count: vec } = await sb.from("profile_embeddings").select("*", { count: "exact", head: true }).eq("document_id", doc.id);
R.report = { upload: up.error?.message ?? "ok", queued_ms: pdMs, queued: pd.data, status: row.status, error: row.error, total_ms: Date.now() - t0 + pdMs, labs: row.extracted_json?.lab_values, vectors: vec, summary: row.summary };

// 2. multi-photo scan
const images = labelImgs.map((f) => ({ image_base64: fs.readFileSync(f).toString("base64"), mime_type: "image/jpeg" }));
const [sc, scMs] = await timed(() => sb.functions.invoke("analyse-label", { body: { images } }));
const a = sc.data;
R.scan = sc.error ? { error: await err(sc.error) } : {
  ms: scMs, photos: images.length, product: a.product, verdict: a.verdict, score: a.score, headline: a.headline,
  nutrition_per_100g: a.nutrition_per_100g, ingredients: a.ingredients, allergen_statement: a.allergen_statement,
  claims: a.claims, claim_checks: a.claim_checks, dates: a.dates, reasons: a.reasons, tips: a.tips, alternatives: a.alternatives,
  summary_en: a.summary_en, summary_ta: a.summary_ta, confidence: a.confidence, report_excerpts_used: a.context_sources?.length,
};

// 3. follow-up question + 4. assistant
const [ask, askMs] = await timed(() => sb.functions.invoke("ask-product", { body: { question: "How many pieces are safe for me today?", label: a } }));
R.ask = ask.error ? { error: await err(ask.error) } : { ms: askMs, answer: ask.data.answer, used_documents: ask.data.used_documents };
const [ch, chMs] = await timed(() => sb.functions.invoke("chat", { body: { messages: [{ role: "user", content: "Suggest a healthier alternative to instant noodles for my dinner." }] } }));
R.chat = ch.error ? { error: await err(ch.error) } : { ms: chMs, reply: ch.data.reply, used_documents: ch.data.used_documents, suggestions: ch.data.suggestions };

// 5. edge case: not a food label (the lab report photo)
const [nf, nfMs] = await timed(() => sb.functions.invoke("analyse-label", { body: { images: [{ image_base64: fs.readFileSync(reportImg).toString("base64"), mime_type: "image/jpeg" }] } }));
R.not_a_label = nf.error ? { error: await err(nf.error) } : { ms: nfMs, readable: nf.data.readable, verdict: nf.data.verdict };

// 6. DB writes the UI performs: scan row, feedback row, chat row
const ins = await sb.from("scans").insert({ user_id: uid, product_name: "Audit scan", label_json: a ?? {}, verdict: a?.verdict ?? "LIMIT", score: Math.round(a?.score ?? 50) });
const fb = await sb.from("feedback").insert({ user_id: uid, email: s.user.email, message: "audit test message" });
const cm = await sb.from("chat_messages").insert({ user_id: uid, role: "user", content: "audit" });
// RLS: another user's rows must be invisible
const { count: foreign } = await sb.from("profiles").select("*", { count: "exact", head: true }).neq("user_id", uid);
R.db = { scan_insert: ins.error?.message ?? "ok", feedback_insert: fb.error?.message ?? "ok", chat_insert: cm.error?.message ?? "ok", other_users_profiles_visible: foreign };

// cleanup audit rows
await sb.from("scans").delete().eq("product_name", "Audit scan");
await sb.from("chat_messages").delete().eq("content", "audit");
await sb.from("feedback").delete().eq("message", "audit test message");
await sb.storage.from("health-docs").remove([path]);
await sb.from("health_documents").delete().eq("id", doc.id);

fs.writeFileSync("e2e/out/audit-api.json", JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
process.exit(0);
