# SmartPack: Build Plan & Feature Checklist

> **One line:** Point your phone at any food packet. In seconds, know what's really inside, whether it's safe *for you*, and where the label is lying.

Legend: `[x]` done · `[ ]` to do · **(M)** must-have for demo · **(S)** should-have · **(N)** nice-to-have

---

## 1. Product summary

SmartPack is a web app (PWA) that reads packaged-food labels from a photo and gives a **personalised verdict** (SAFE / LIMIT / AVOID) based on the user's own health profile: conditions, goals, allergies and checkup reports.

**What makes it different**
- Reads the label itself, so it works for local brands with no barcode database entry.
- **Hidden ingredient hunter**: sugar hides under 50+ names (maltodextrin, dextrose, invert syrup…).
- **Label Lie Detector**: checks front-of-pack claims ("No added sugar", "Multigrain") against the real ingredients.
- **Knows your body**: the same packet gets a different verdict for a diabetic, someone on a sugar cut, or a gym-goer bulking.
- **Code does the maths, AI explains**: calories, limits and safe quantity are deterministic; the AI never invents numbers.

---

## 2. Architecture

```
┌──────────────────────────────┐
│  Next.js static PWA          │  GitHub Pages (https://<user>.github.io/smartpack)
│  login · onboarding · scan   │  no secrets in the browser
└──────────────┬───────────────┘
               │ supabase-js (user JWT)
┌──────────────▼──────────────────────────────────────────────┐
│  Supabase                                                   │
│  Auth (Google + email) · Postgres + RLS · pgvector · Storage │
│  ai_jobs queue (dev mode)  ·  Edge Functions (prod mode) ───┼──► Gemini API
└─────────────────────────────────────────────────────────────┘
```

### 2.1 AI provider modes (important)

The app talks to **one AI interface** (`analyseLabel`, `processProfile`). Behind it there are three interchangeable providers, chosen by `NEXT_PUBLIC_AI_MODE`:

| Mode | Where | How it works | Use for |
|---|---|---|---|
| `local` | Browser | Tesseract.js OCR + deterministic engine only (no LLM). Free, offline-capable. | Fallback, offline demo, engine testing |
| `claude-dev` | Localhost | App inserts a row in `ai_jobs` (image + prompt). **Claude Code** (in the IDE, on the team's Claude subscription) reads pending jobs, analyses the image, writes JSON back. App polls and shows the result. | Development & prompt tuning without API costs |
| `gemini` | Production | App calls Supabase Edge Function → Gemini (vision, embeddings, reasoning). Key stored as a Supabase secret. | GitHub Pages / demo day |

> ⚠️ A Claude Pro subscription **cannot be called as an API** from a website. `claude-dev` is a human-in-the-loop dev workflow (each job takes ~20–60 s and needs Claude Code running). It is **not** for production or the live demo. The live demo must use `gemini` (with `local` as backup).

**Same contract in every mode:** every provider returns the same Zod-validated JSON (`LabelExtraction`, `Verdict`), so switching modes changes zero UI code.

---

## 3. End-to-end user flow

1. Land on homepage → **Get started**
2. Sign up / sign in (Google or email)
3. Onboarding (3 steps): about you → your health → reports (optional)
4. Profile processing (background): report extraction → Health Rulebook → embeddings
5. Home: daily limits, today's budget, recent scans, **Scan** button
6. Scan: take/upload photo → quality check → extraction → engine → personalised verdict
7. Result: verdict, why, safe quantity, hidden ingredients, claim check, dates, calories, alternatives, voice
8. "I ate this" → daily budget updates → history & weekly insights

---

## 4. Feature checklist

### Phase 0: Setup & infrastructure
- [x] Next.js 16 app (TypeScript, Tailwind, App Router, static export)
- [x] Libraries: supabase-js, tesseract.js, chrono-node, date-fns, zod, recharts, lucide-react
- [x] Supabase project created (SMARTPACK), CLI linked
- [x] Database schema migrated: `profiles`, `health_documents`, `profile_embeddings`, `knowledge_chunks`, `ingredient_aliases`, `scans`, `daily_intake`
- [x] pgvector (768-dim) + `match_profile_chunks` / `match_knowledge` search functions
- [x] Row Level Security on every table; private storage buckets `health-docs`, `scan-images`
- [x] Google OAuth (Google Cloud client + Supabase provider), email sign-in, email confirmation off for demo
- [x] `.env.local` with public Supabase URL + key; secrets git-ignored
- [x] GitHub Actions workflow → GitHub Pages deploy
- [x] Public GitHub repo created, repo variables set, Pages enabled → https://dhannussh1.github.io/smartpack/
- [x] Add production URL to Supabase **Auth → URL Configuration → Redirect URLs**
- [ ] Verify Google sign-in end to end on the live site
- [ ] Gemini API key → `npx supabase secrets set GEMINI_API_KEY=…`
- [ ] PWA manifest + icons (installable on phone home screen) **(S)**

### Phase 1: Auth & onboarding **(M)**
- [x] Landing page with value proposition
- [x] Login page: Google button + email/password sign-in/sign-up
- [x] OAuth callback page (PKCE) + route guards (signed out → login, no profile → onboarding)
- [x] Onboarding step 1: name, DOB (auto age), gender, height, weight, activity level
- [x] Live BMI (Asian cut-offs), BMR (Mifflin–St Jeor), daily calorie need
- [x] Onboarding step 2: conditions, allergies, diet preference, goals (chips), health paragraph (required)
- [x] Onboarding step 3: optional report upload (PDF/image ≤ 10 MB) to private bucket
- [x] Baseline **Health Rulebook** computed in code (sugar, sodium, sat-fat, carbs, protein limits from WHO/ICMR/AHA)
- [x] Home dashboard: daily limits, BMI, conditions, goals, edit profile, sign out
- [ ] Delete-my-data button (profile, scans, reports, embeddings) **(S)**
- [ ] "Not medical advice" consent checkbox on onboarding **(S)**

### Phase 2: Profile intelligence (vectors) **(M)**
- [ ] `ai_jobs` table + RLS (dev mode queue)
- [ ] Edge Function `process-profile`:
  - [ ] Read uploaded report from storage → Gemini extracts lab values (HbA1c, fasting glucose, LDL, HDL, triglycerides, BP, TSH, creatinine, vitamin D…) → `health_documents.extracted_json`
  - [ ] Refine Rulebook with lab values (e.g. HbA1c ≥ 6.5 → strict sugar; LDL > 130 → strict sat-fat)
  - [ ] Chunk profile + health text + report summary + rulebook → Gemini embeddings → `profile_embeddings`
  - [ ] Set `profiles.processing_status` = ready / failed
- [ ] Home shows "Profile analysed ✓" + extracted lab values
- [ ] Re-process automatically when the profile is edited

### Phase 3: Knowledge base **(M)**
- [ ] Seed `ingredient_aliases` (target 300+ rows):
  - [ ] Hidden sugars (50+): sucrose, dextrose, maltodextrin, glucose syrup, invert sugar, HFCS, jaggery, honey, fruit juice concentrate, maltose, corn syrup solids…
  - [ ] Fats: palm oil / palmolein, hydrogenated / partially hydrogenated oil (trans fat), interesterified fat, vanaspati
  - [ ] Sodium sources: salt, MSG (E621), sodium benzoate (E211), baking soda, disodium inosinate/guanylate
  - [ ] Additives (E-numbers): colours (E102 tartrazine, E110, E129…), preservatives, sweeteners (aspartame, sucralose, acesulfame-K)
  - [ ] Allergens: milk, peanut, tree nuts, gluten/wheat, soy, egg, sesame, shellfish + Indian names (maida, atta, besan…)
  - [ ] Diet conflicts: gelatin, egg, onion/garlic (Jain), animal rennet, E120 (carmine)
- [ ] Seed `knowledge_chunks` with guideline snippets + embeddings: FSSAI labelling rules, ICMR-NIN dietary guidelines 2024, WHO sugar/sodium/trans-fat, ADA diabetes nutrition, AHA heart guidance
- [ ] Python/Node seed script (`scripts/seed-knowledge.*`) using the service-role key locally (never committed)

### Phase 4: Scan pipeline **(M)**
- [x] Scan page: take photo (rear camera) or upload, preview
- [ ] Image pre-processing: resize to ≤ 1600 px, JPEG compress, blur/darkness check → "retake photo" prompt
- [ ] Multi-photo scan: front of pack + back label in one scan **(S)**
- [ ] Upload image to `scan-images/<uid>/…`
- [ ] **Extraction** (provider) → strict JSON `LabelExtraction`:
  - product name, brand, net weight, serving size, servings per pack
  - nutrition table per 100 g and per serving (energy, protein, carbs, total sugar, added sugar, fat, sat fat, trans fat, sodium, fibre)
  - ingredients list (ordered), allergen statement, "may contain traces"
  - front-of-pack claims ("No added sugar", "Multigrain", "High protein", "Natural"…)
  - manufacture date, expiry / best-before, FSSAI licence no., veg/non-veg mark
  - confidence per field
- [ ] Zod validation + low-confidence fallback ("We couldn't read the nutrition table, retake?")
- [ ] **Deterministic engine** (`src/lib/engine/*`, pure TypeScript, unit-tested):
  - [ ] Ingredient normaliser + alias matching → hidden sugars, trans fats, palm oil, MSG, E-numbers, allergens, diet conflicts
  - [ ] Calories & macros per serving / per pack; % of user's daily need
  - [ ] Sugar in teaspoons (4 g = 1 tsp)
  - [ ] Date check: expired / expires ≤ 7 days / OK / not found (chrono-node + "best before N months from mfg")
  - [ ] **Safe quantity** = min over nutrients of (user daily limit ÷ amount per serving), capped by goal → "max 2 biscuits / day"
  - [ ] Rule-based verdict floor (e.g. allergen match ⇒ AVOID, expired ⇒ AVOID, trans fat > 0.2 g ⇒ LIMIT)
  - [ ] Health score 0–100
- [ ] **Label Lie Detector** (engine rules + AI wording):
  - [ ] "No added sugar" but sugar aliases present
  - [ ] "Multigrain / whole wheat" but first ingredient is maida / refined flour
  - [ ] "Low fat" but sugar high
  - [ ] "Natural" with artificial colours / flavours
  - [ ] "High protein" below FSSAI threshold (protein < 20% energy)
  - [ ] "Sugar free" with maltitol / sweeteners → note for diabetics
  - [ ] Output: "4 claims checked, 2 misleading"
- [ ] **Personalised reasoning (RAG)**: embed label summary → retrieve top user chunks + guideline chunks → LLM gets label JSON + engine flags + context → strict JSON `Verdict` (verdict, headline, reasons with citations, tips, alternatives). The LLM can't override an engine AVOID.
- [ ] Save to `scans` (label_json, engine_json, verdict_json, verdict, score)

### Phase 5: Result screen **(M)**
- [ ] Big verdict badge SAFE / LIMIT / AVOID + score + one-line headline
- [ ] "Why, for you": reasons referencing the user's own data ("Your HbA1c is 6.8 and this has 3 sugar sources")
- [ ] Safe quantity card
- [ ] Hidden ingredients list with plain-language explanation + **highlighted ingredient text** (sugar aliases in red)
- [ ] Label Lie Detector card
- [ ] Nutrition per serving + % of daily limits (bars) + sugar teaspoon visual
- [ ] Expiry status chip
- [ ] Allergen alert banner (bold red)
- [ ] Healthier alternatives (2–3 suggestions)
- [ ] "I ate this" button (servings stepper) → `daily_intake`
- [ ] Disclaimer footer

### Phase 6: Engagement & impact
- [ ] Daily budget tracker on home: "18 g of your 25 g sugar used today" **(S)**
- [ ] Scan history list + scan detail page **(S)**
- [ ] Voice output: Web Speech API, English / Tamil / Hindi verdict summary **(S)**
- [ ] Compare mode: two packets side by side for this user **(N)**
- [ ] Weekly insights: top risky foods, average sugar per item (Recharts) **(N)**
- [ ] Family profiles (parent / child) with profile switcher **(N)**
- [ ] Doctor-share PDF summary **(N)**
- [ ] Offline mode: Tesseract + engine only, sync later **(N)**

### Phase 7: Dev-mode bridge (`claude-dev`) **(S, dev only)**
- [ ] `ai_jobs` table: id, user_id, kind (`extract_label` / `verdict` / `process_profile`), input_json, image_path, status (pending / running / done / failed), output_json, timestamps
- [ ] Provider `claude-dev`: insert job → poll every 2 s (or Supabase Realtime) → resolve with output_json
- [ ] `scripts/dev-jobs` helper: list pending jobs, download the image, write the result back (used by Claude Code)
- [ ] Shared system prompts in `prompts/*.md`, the same text used by the Gemini Edge Functions, so tuning in dev carries to prod

### Phase 8: Production hardening **(M before demo)**
- [ ] Edge Functions: `process-profile`, `extract-label`, `analyse-scan` (verify JWT, rate-limit per user, timeouts, retries)
- [ ] Gemini models: vision + reasoning (Flash), embeddings (768-dim)
- [ ] Error states everywhere (network, AI timeout, unreadable label)
- [ ] Accuracy test: 20 real packets, measure field-level extraction accuracy, put the number on the pitch slide
- [ ] Backup: second Gemini key, `local` mode fallback, recorded demo video
- [ ] Mobile QA (Android Chrome, iOS Safari camera)
- [ ] Lighthouse PWA / performance pass

### Phase 9: Demo & pitch
- [ ] Two pre-made demo accounts: **Diabetic on sugar cut** and **Gym bulking**
- [ ] 5 "problem packets" with misleading claims ready on the table
- [ ] 3-minute script: hook → judge's own packet → hidden sugar reveal → profile switch flips verdict → Tamil voice → one architecture slide → impact close
- [ ] Prepared answers: hallucination (engine + RAG + schema), privacy (RLS, private buckets, delete data), accuracy (measured), scale (serverless)

---

## 5. Data model (live in Supabase)

| Table | Purpose |
|---|---|
| `profiles` | Personal details, conditions, goals, health text, BMI/BMR/daily kcal, `rulebook` JSON |
| `health_documents` | Uploaded reports + extracted lab values |
| `profile_embeddings` | Per-user vector chunks (768-dim) |
| `knowledge_chunks` | Shared guideline vectors (FSSAI, ICMR, WHO, ADA, AHA) |
| `ingredient_aliases` | Alias → canonical ingredient, category, risk, explanation |
| `scans` | Label JSON, engine flags, verdict per scan |
| `daily_intake` | What the user actually ate → daily budget |
| `ai_jobs` *(to add)* | Dev-mode queue for Claude Code |

---

## 6. Tech stack (all free tier)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (static export) · React 19 · Tailwind 4 · lucide-react · Recharts |
| Hosting | GitHub Pages via GitHub Actions |
| Auth | Supabase Auth (Google OAuth + email) |
| Database | Supabase Postgres + RLS |
| Vectors | pgvector (HNSW, cosine) |
| Files | Supabase Storage (private buckets) |
| Backend | Supabase Edge Functions (Deno) |
| AI (prod) | Gemini: vision extraction, report parsing, embeddings, reasoning |
| AI (dev) | Claude Code via `ai_jobs` queue |
| OCR fallback | Tesseract.js (in browser) |
| Validation | Zod |
| Dates | chrono-node, date-fns |
| Voice | Web Speech API |

---

## 7. Security & privacy
- No secret keys in the frontend: the Gemini key lives in Supabase secrets; only the public (publishable) key ships to the browser.
- RLS: every user can read/write only their own rows; reference tables are read-only.
- Storage paths are `<user_id>/…` and policies enforce it.
- Health reports in a private bucket; delete-my-data planned.
- Clear "guidance, not medical advice" messaging.

---

## 8. Build order (priority)
1. ~~Setup, auth, onboarding~~ ✅
2. ~~Deploy to GitHub Pages~~ ✅ (verify Google login in production)
3. Ingredient alias seed + deterministic engine (works with no AI at all)
4. `claude-dev` bridge for extraction while building the UI
5. Result screen
6. Gemini Edge Functions (extract → verdict) + knowledge base RAG
7. Profile processing (report extraction + embeddings)
8. Daily budget, history, voice
9. Accuracy test, demo accounts, backup video, pitch

**Cut first if time is short:** family profiles → doctor PDF → offline mode → compare mode → weekly insights.

---

## 9. Run locally

```bash
cd smartpack
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

Database changes: add a file under `supabase/migrations/`, then `npx supabase db push --remote`.
