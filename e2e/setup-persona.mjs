// Prepares the demo persona on the test account (not a real user).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).replace(/^﻿/, "").trim(), l.slice(i + 1).trim()];
  }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: s, error } = await sb.auth.signInWithPassword({ email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
if (error) throw error;
const uid = s.user.id;
const { error: pe } = await sb.from("profiles").upsert({
  user_id: uid,
  full_name: "Arun Kumar",
  dob: "1980-05-01",
  gender: "male",
  height_cm: 170,
  weight_kg: 82,
  activity_level: "light",
  conditions: ["diabetes", "high_cholesterol", "hypertension"],
  allergies: [],
  diet_prefs: ["vegetarian"],
  goals: ["sugar_cut", "low_sodium"],
  health_text: "Type 2 diabetic for 4 years, on metformin. BP medicine since last year. Trying to cut sugar and salt.",
  bmi: 28.4,
  bmr_kcal: 1650,
  daily_kcal: 2269,
  rulebook: {
    daily_kcal: 2269, sugar_g_max: 25, sodium_mg_max: 1500, sat_fat_g_max: 18, carbs_g_max: null, protein_g_min: null,
    avoid_allergens: [], diet: ["vegetarian"], watch: ["hidden_sugar", "sodium", "saturated_fat", "trans_fat"],
  },
  processing_status: "ready",
});
if (pe) throw pe;
// fresh start for the demo: clear old scans + chat
await sb.from("scans").delete().eq("user_id", uid);
await sb.from("chat_messages").delete().eq("user_id", uid);
// remove the placeholder record from the very first upload test
const { data: junk } = await sb.from("health_documents").select("id, file_path").eq("user_id", uid).eq("file_name", "test.pdf");
for (const j of junk ?? []) {
  await sb.storage.from("health-docs").remove([j.file_path]);
  await sb.from("health_documents").delete().eq("id", j.id);
}
const { data: docs } = await sb.from("health_documents").select("file_name, status").eq("user_id", uid);
console.log("persona ready:", uid, "docs:", JSON.stringify(docs));
process.exit(0);
