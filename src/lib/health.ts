// Deterministic health maths. The LLM never computes these numbers.

export type Gender = "male" | "female" | "other";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Light (1–3 workouts / week)",
  moderate: "Moderate (3–5 workouts / week)",
  active: "Active (6–7 workouts / week)",
  very_active: "Very active (athlete / physical job)",
};

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const CONDITIONS = [
  { id: "diabetes", label: "Diabetes" },
  { id: "prediabetes", label: "Pre-diabetes" },
  { id: "high_cholesterol", label: "High cholesterol" },
  { id: "hypertension", label: "High BP" },
  { id: "thyroid", label: "Thyroid" },
  { id: "pcos", label: "PCOS / PCOD" },
  { id: "kidney", label: "Kidney issues" },
  { id: "heart", label: "Heart condition" },
  { id: "fatty_liver", label: "Fatty liver" },
  { id: "pregnancy", label: "Pregnant" },
];

export const ALLERGIES = [
  { id: "peanut", label: "Peanut" },
  { id: "tree_nut", label: "Tree nuts" },
  { id: "milk", label: "Milk / lactose" },
  { id: "gluten", label: "Gluten" },
  { id: "soy", label: "Soy" },
  { id: "egg", label: "Egg" },
  { id: "shellfish", label: "Shellfish" },
  { id: "sesame", label: "Sesame" },
];

/** Main diet type: pick exactly one. */
export const DIET_TYPES = [
  { id: "non_vegetarian", label: "Non-vegetarian", hint: "Eats meat, fish, eggs and dairy. No ingredient restrictions." },
  { id: "eggetarian", label: "Eggetarian", hint: "Vegetarian + eggs. We flag meat, fish, gelatin and animal fats." },
  { id: "vegetarian", label: "Vegetarian", hint: "No meat, fish or eggs; dairy is fine. We flag gelatin, egg, animal rennet, E120 (carmine)." },
  { id: "vegan", label: "Vegan", hint: "No animal products at all. We also flag milk solids, whey, casein, ghee, honey." },
  { id: "jain", label: "Jain", hint: "Vegetarian without onion, garlic, potato or other root vegetables. Those get flagged too." },
];

/** Extra dietary rules on top of the diet type: any number. */
export const DIET_RULES = [
  { id: "halal", label: "Halal", hint: "We flag pork, lard, alcohol/wine extracts and non-halal gelatin." },
  { id: "no_beef", label: "No beef", hint: "We flag beef, beef fat (tallow) and beef gelatin." },
  { id: "no_onion_garlic", label: "No onion / garlic", hint: "We flag onion and garlic in any form (powder, extract)." },
];

export const GOALS = [
  { id: "sugar_cut", label: "Sugar cut" },
  { id: "calorie_deficit", label: "Weight loss / calorie deficit" },
  { id: "muscle_gain", label: "Gym / muscle gain" },
  { id: "keto", label: "Keto / low carb" },
  { id: "low_sodium", label: "Low salt" },
  { id: "heart_healthy", label: "Heart healthy" },
  { id: "maintain", label: "Just eat healthier" },
];

export function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function bmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(v: number): { label: string; tone: "good" | "warn" | "bad" } {
  // Asian cut-offs (WHO expert consultation / ICMR)
  if (v < 18.5) return { label: "Underweight", tone: "warn" };
  if (v < 23) return { label: "Healthy", tone: "good" };
  if (v < 25) return { label: "Overweight", tone: "warn" };
  return { label: "Obese", tone: "bad" };
}

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
export function bmr(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const adj = gender === "male" ? 5 : gender === "female" ? -161 : -78;
  return Math.round(base + adj);
}

export function dailyCalories(bmrKcal: number, activity: Activity, goals: string[]): number {
  let kcal = bmrKcal * ACTIVITY_FACTOR[activity];
  if (goals.includes("calorie_deficit")) kcal -= 500;
  else if (goals.includes("muscle_gain")) kcal += 300;
  return Math.round(Math.max(kcal, 1200));
}

export type Rulebook = {
  daily_kcal: number;
  sugar_g_max: number; // added / free sugar
  sodium_mg_max: number;
  sat_fat_g_max: number;
  carbs_g_max: number | null;
  protein_g_min: number | null;
  avoid_allergens: string[];
  diet: string[];
  watch: string[]; // things the engine should flag loudly
};

/** Baseline personal limits from WHO / ICMR-NIN / AHA guidance. Refined later by the AI from reports. */
export function baseRulebook(p: {
  daily_kcal: number;
  weight_kg: number;
  conditions: string[];
  allergies: string[];
  diet_prefs: string[];
  goals: string[];
}): Rulebook {
  const c = new Set(p.conditions);
  const g = new Set(p.goals);
  const sugarStrict = c.has("diabetes") || c.has("prediabetes") || c.has("pcos") || c.has("fatty_liver") || g.has("sugar_cut");

  const watch: string[] = [];
  if (sugarStrict) watch.push("hidden_sugar");
  if (c.has("hypertension") || c.has("kidney") || c.has("heart") || g.has("low_sodium")) watch.push("sodium");
  if (c.has("high_cholesterol") || c.has("heart") || g.has("heart_healthy")) watch.push("saturated_fat", "trans_fat");
  if (g.has("keto")) watch.push("carbs");
  if (g.has("calorie_deficit")) watch.push("calories");
  if (c.has("pregnancy")) watch.push("caffeine", "artificial_sweeteners");

  return {
    daily_kcal: p.daily_kcal,
    // WHO: free sugars <10% energy, ideally <5% (≈25 g)
    sugar_g_max: sugarStrict ? 25 : Math.round((p.daily_kcal * 0.1) / 4),
    // WHO: <2000 mg sodium; AHA ideal 1500 mg for hypertension
    sodium_mg_max: watch.includes("sodium") ? 1500 : 2000,
    // <10% energy (general), <7% for cholesterol / heart
    sat_fat_g_max: Math.round((p.daily_kcal * (watch.includes("saturated_fat") ? 0.07 : 0.1)) / 9),
    carbs_g_max: g.has("keto") ? 50 : null,
    protein_g_min: g.has("muscle_gain") ? Math.round(p.weight_kg * 1.6) : null,
    avoid_allergens: p.allergies,
    diet: p.diet_prefs,
    watch,
  };
}
