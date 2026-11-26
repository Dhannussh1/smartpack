// Deterministic checks: the AI explains, code decides the hard facts.
import type { Rulebook } from "./health";

export type Analysis = {
  product: { name: string | null; brand: string | null; net_weight_g: number | null; serving_size_g: number | null; servings_per_pack: number | null; veg_mark: string | null };
  nutrition_per_100g: Record<string, number | null>;
  ingredients: string[];
  allergen_statement: string | null;
  claims: string[];
  dates: { mfg: string | null; expiry: string | null; best_before_text: string | null };
  claim_checks: { claim: string; verdict: "ok" | "misleading" | "unverifiable"; reason: string }[];
  verdict: "SAFE" | "LIMIT" | "AVOID";
  score: number;
  headline: string;
  reasons: string[];
  tips: string[];
  alternatives: string[];
  summary_en: string;
  summary_ta: string;
  confidence: number;
  readable: boolean;
};

type Cat = "hidden_sugar" | "sweetener" | "bad_fat" | "palm_oil" | "sodium" | "additive" | "colour";
const ALIASES: [RegExp, Cat, string][] = [
  [/\b(sugar|sucrose)\b/, "hidden_sugar", "Plain sugar"],
  [/maltodextrin/, "hidden_sugar", "Maltodextrin: spikes blood sugar faster than table sugar"],
  [/dextrose/, "hidden_sugar", "Dextrose: pure glucose"],
  [/glucose(\s|-)?syrup|liquid glucose|\bglucose\b/, "hidden_sugar", "Glucose / glucose syrup"],
  [/invert(ed)?\s*(sugar|syrup)/, "hidden_sugar", "Invert syrup: a liquid sugar"],
  [/fructose|hfcs|corn syrup/, "hidden_sugar", "Fructose / corn syrup"],
  [/malt(ose| extract)/, "hidden_sugar", "Malt / maltose"],
  [/honey/, "hidden_sugar", "Honey"],
  [/jaggery|gur\b/, "hidden_sugar", "Jaggery: still sugar"],
  [/(fruit|juice)\s*concentrate/, "hidden_sugar", "Fruit juice concentrate: counts as added sugar"],
  [/lactose|milk solids/, "hidden_sugar", "Lactose / milk sugars"],
  [/caramel/, "hidden_sugar", "Caramel"],
  [/aspartame|sucralose|acesulfame|saccharin|stevia|maltitol|sorbitol|e95[0-5]|e96[0-9]|e420|e965/, "sweetener", "Artificial sweetener / sugar alcohol"],
  [/hydrogenated|vanaspati|shortening|interesterified/, "bad_fat", "Hydrogenated fat: trans-fat risk"],
  [/palm(olein| oil|\s*kernel)/, "palm_oil", "Palm oil: high in saturated fat"],
  [/monosodium glutamate|\bmsg\b|e621|e627|e631|e635/, "sodium", "MSG / flavour enhancer: adds sodium"],
  [/sodium benzoate|e211|sodium bicarbonate|e500/, "sodium", "Sodium-based additive"],
  [/\bsalt\b|iodised salt/, "sodium", "Salt"],
  [/tartrazine|e102|sunset yellow|e110|e129|allura|e124|e122|carmoisine/, "colour", "Synthetic colour, linked to hyperactivity in kids"],
  [/e3[2-9]\d|preservative|e2\d\d/, "additive", "Preservative / additive"],
];

const ALLERGEN_WORDS: Record<string, RegExp> = {
  peanut: /peanut|groundnut/,
  tree_nut: /almond|cashew|walnut|pistachio|hazelnut|tree nut/,
  milk: /milk|whey|casein|lactose|butter|ghee|cream|cheese/,
  gluten: /wheat|maida|atta|gluten|barley|rye|oats|semolina|sooji/,
  soy: /soy|soya/,
  egg: /\begg/,
  shellfish: /shrimp|prawn|crab|lobster|shellfish/,
  sesame: /sesame|til\b/,
};

const DIET_WORDS: Record<string, RegExp> = {
  vegetarian: /gelatin|\begg|meat|chicken|fish|carmine|e120|lard|animal rennet/,
  eggetarian: /gelatin|meat|chicken|fish|lard/,
  vegan: /gelatin|\begg|meat|chicken|fish|milk|whey|casein|ghee|butter|honey|cream|cheese|lactose/,
  jain: /onion|garlic|potato|carrot|beetroot|ginger|gelatin|\begg/,
  halal: /pork|lard|bacon|ham|wine|alcohol|rum/,
  no_beef: /beef|tallow/,
  no_onion_garlic: /onion|garlic/,
};

export type Flag = { ingredient: string; category: Cat; note: string };

export type EngineResult = {
  flags: Flag[];
  hiddenSugars: Flag[];
  allergenHits: string[];
  dietHits: string[];
  perServing: { kcal: number | null; sugar: number | null; sodium: number | null; satFat: number | null; grams: number };
  sugarTsp: number | null;
  maxServings: number | null;
  limitingNutrient: string | null;
  expiry: { status: "expired" | "soon" | "ok" | "unknown"; text: string };
  forcedVerdict: "AVOID" | "LIMIT" | null;
  forcedReason: string | null;
};

export function runEngine(a: Analysis, rb: Rulebook | null): EngineResult {
  const ing = a.ingredients.map((s) => s.toLowerCase());
  const flags: Flag[] = [];
  ing.forEach((text, i) => {
    for (const [re, category, note] of ALIASES) {
      if (re.test(text)) {
        flags.push({ ingredient: a.ingredients[i], category, note });
        break;
      }
    }
  });
  const hiddenSugars = flags.filter((f) => f.category === "hidden_sugar");

  const allText = [...ing, (a.allergen_statement ?? "").toLowerCase()].join(" | ");
  const allergenHits = (rb?.avoid_allergens ?? []).filter((al) => ALLERGEN_WORDS[al]?.test(allText));
  const dietHits = (rb?.diet ?? []).filter((d) => DIET_WORDS[d]?.test(ing.join(" | ")));

  const n = a.nutrition_per_100g;
  const grams = a.product.serving_size_g ?? 30;
  const per = (v: number | null | undefined) => (v == null ? null : Math.round((v * grams) / 10) / 10);
  const sugarPer100 = n.added_sugar_g ?? n.total_sugar_g ?? null;
  const perServing = { kcal: per(n.energy_kcal), sugar: per(sugarPer100), sodium: per(n.sodium_mg), satFat: per(n.sat_fat_g), grams };

  // safe servings per day = tightest of (personal limit ÷ amount per serving)
  let maxServings: number | null = null;
  let limitingNutrient: string | null = null;
  if (rb) {
    const checks: [string, number | null, number][] = [
      ["sugar", perServing.sugar, rb.sugar_g_max],
      ["sodium", perServing.sodium, rb.sodium_mg_max],
      ["saturated fat", perServing.satFat, rb.sat_fat_g_max],
    ];
    for (const [name, amt, lim] of checks) {
      if (amt && amt > 0) {
        const s = lim / amt;
        if (maxServings == null || s < maxServings) {
          maxServings = s;
          limitingNutrient = name;
        }
      }
    }
    // one snack shouldn't eat more than a third of the day's budget
    if (maxServings != null) maxServings = Math.max(0, Math.floor((maxServings / 3) * 2) / 2);
  }

  const expiry = checkExpiry(a.dates);

  let forcedVerdict: EngineResult["forcedVerdict"] = null;
  let forcedReason: string | null = null;
  if (allergenHits.length) [forcedVerdict, forcedReason] = ["AVOID", `Contains ${allergenHits.join(", ")}, which is on your allergy list`];
  else if (expiry.status === "expired") [forcedVerdict, forcedReason] = ["AVOID", "This product has expired"];
  else if (dietHits.length) [forcedVerdict, forcedReason] = ["AVOID", "Contains ingredients that don't fit your diet"];
  else if ((n.trans_fat_g ?? 0) > 0.2 || flags.some((f) => f.category === "bad_fat")) [forcedVerdict, forcedReason] = ["LIMIT", "Contains trans fat / hydrogenated oil"];

  return {
    flags,
    hiddenSugars,
    allergenHits,
    dietHits,
    perServing,
    sugarTsp: perServing.sugar != null ? Math.round((perServing.sugar / 4) * 10) / 10 : null,
    maxServings,
    limitingNutrient,
    expiry,
    forcedVerdict,
    forcedReason,
  };
}

function checkExpiry(d: Analysis["dates"]): EngineResult["expiry"] {
  const raw = d.expiry;
  if (!raw) return { status: "unknown", text: d.best_before_text ?? "Expiry date not found on photo" };
  const parsed = parseDate(raw);
  if (!parsed) return { status: "unknown", text: `Printed: ${raw}` };
  const days = Math.floor((parsed.getTime() - Date.now()) / 86400000);
  if (days < 0) return { status: "expired", text: `Expired ${-days} days ago (${raw})` };
  if (days <= 7) return { status: "soon", text: `Expires in ${days} days (${raw})` };
  return { status: "ok", text: `Good till ${raw}` };
}

function parseDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})[\/\-. ](\d{1,2}|[a-z]{3})[\/\-. ](\d{2,4})/i);
  if (m) {
    const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
    const mon = isNaN(Number(m[2])) ? months.indexOf(m[2].toLowerCase().slice(0, 3)) : Number(m[2]) - 1;
    const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(yr, mon, Number(m[1]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export function finalVerdict(a: Analysis, e: EngineResult): "SAFE" | "LIMIT" | "AVOID" {
  const rank = { SAFE: 0, LIMIT: 1, AVOID: 2 } as const;
  if (e.forcedVerdict && rank[e.forcedVerdict] > rank[a.verdict]) return e.forcedVerdict;
  return a.verdict;
}
