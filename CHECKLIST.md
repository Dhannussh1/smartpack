# SmartPack: Master Checklist

Live: https://dhannussh1.github.io/smartpack/ · Repo: https://github.com/Dhannussh1/smartpack · Detailed design: [plan.md](plan.md)

Legend: `[x]` done · `[ ]` to do · 🔴 must before demo · 🟠 should · 🟡 nice · **Owner:** 🤖 Claude · 👤 Team

---

## 1. Build / Dev

### 1.1 Infrastructure
- [x] Next.js 16 static app + Tailwind + Motion animations 🤖
- [x] Supabase project (SMARTPACK): Postgres, RLS on every table, pgvector, private storage buckets 🤖
- [x] Google + email sign-in, redirect URLs (localhost + GitHub Pages) 🤖👤
- [x] GitHub public repo + Actions auto-deploy to GitHub Pages 🤖
- [x] 3 Gemini keys stored as Supabase secrets (never in the browser or git) 🤖👤
- [x] Edge Function `analyse-label` with model/key failover (503/429) 🤖
- [ ] 🟡 PWA manifest + icons (installable on phone home screen) 🤖
- [ ] 🟡 Upgrade deploy actions off deprecated Node 20 🤖

### 1.2 Onboarding & profile
- [x] Landing page with animated scan demo 🤖
- [x] Login page (Google + email) 🤖
- [x] 3-step onboarding: about you → health → reports 🤖
- [x] Live BMI / BMR / daily calories 🤖
- [x] Conditions, allergies, diet type (with definitions) + extra diet rules, goals, optional health paragraph 🤖
- [x] Report upload to private bucket 🤖
- [x] Baseline Health Rulebook (sugar, sodium, sat-fat, carbs, protein limits) 🤖
- [x] Home dashboard: limits with WATCH badges, profile tags, recent scans 🤖
- [x] 🔴 **Report processing**: Gemini extracts lab values (HbA1c, glucose, LDL, BP, TSH…) → tighter rulebook → shown on home 🤖
- [ ] 🟠 Delete-my-data button (profile, scans, reports, embeddings) 🤖
- [ ] 🟠 "Guidance, not medical advice" consent checkbox in onboarding 🤖

### 1.3 Scan pipeline
- [x] Camera / upload, image compression (≤1600 px JPEG) 🤖
- [x] Gemini vision: label → structured JSON (product, nutrition, ingredients, claims, dates, allergens) 🤖
- [x] Personalised verdict SAFE / LIMIT / AVOID + score + reasons, using profile + rulebook + lab values 🤖
- [x] Deterministic engine: hidden sugars & additives, allergen + diet conflicts (force AVOID), teaspoons, safe servings, expiry, trans-fat floor 🤖
- [x] Label Lie Detector (claim checks) 🤖
- [x] Scans saved to history 🤖
- [ ] 🟠 Multi-photo scan (front + back of pack together) 🤖
- [ ] 🟡 Offline fallback (Tesseract OCR + engine) when Gemini is down 🤖

### 1.4 Result & engagement
- [x] Result screen: verdict card, safe amount, sugar teaspoons, why-for-you, lie detector, highlighted ingredients, expiry, better choices 🤖
- [x] Voice: English + Tamil 🤖
- [x] Live camera capture (getUserMedia) + upload fallback 🤖
- [x] Menu: Home, Scan, Health profile, My documents, Contact, Sign out 🤖
- [x] My documents: upload new, view old (2-min private link), re-analyse, delete (vectors removed too) 🤖
- [x] Ask about this product: answers from profile + report vectors, EN/Tamil voice 🤖
- [x] Contact form (feedback table) 🤖
- [ ] 🔴 **"I ate this" → daily budget** ("18 g of 25 g sugar used today") on home 🤖
- [ ] 🟠 Scan history detail (tap a past scan to reopen the full result) 🤖
- [ ] 🟠 Compare mode (two packets side by side) 🤖
- [ ] 🟡 Weekly insights chart 🤖
- [ ] 🟡 Family profiles 🤖

### 1.5 Intelligence (RAG): pgvector HNSW (FAISS-style ANN inside Supabase)
- [x] 🟠 Profile embeddings → `profile_embeddings` (key: EMBED) 🤖
- [ ] 🟠 Guideline knowledge base (FSSAI, ICMR-NIN, WHO, ADA, AHA) → `knowledge_chunks` 🤖
- [x] 🟠 Verdict retrieves top user + guideline chunks and cites sources 🤖

---

## 2. Test

### 2.1 Functional (run on laptop **and** phone)
- [x] Google sign-in works on desktop 👤
- [x] Profile save works 👤
- [x] End-to-end scan on a sample label: AVOID 12/100, both fake claims caught, 11.5 s 🤖
- [ ] 🔴 Google sign-in on the **live site on phone** 👤
- [ ] 🔴 Camera opens on phone (Android Chrome; iPhone Safari if available) 👤
- [ ] 🔴 Report upload works (Edit profile → step 3) 👤
- [ ] 🔴 Tamil + English voice plays on phone 👤
- [ ] 🟠 Sign out / sign back in keeps profile and scan history 👤
- [ ] 🟠 Edit profile changes the verdict for the same packet 👤

### 2.2 Accuracy (the number for the pitch slide)
- [ ] 🔴 20 label photos in `test-labels/` 👤
- [ ] 🔴 Run all 20 and record extraction accuracy (nutrition values, ingredients, dates) 🤖
- [ ] 🟠 Fix the worst failures (prompt / engine rules) 🤖
- [ ] 🟠 Average scan time < 15 s 🤖

### 2.3 Edge cases
- [ ] 🟠 Blurry / dark photo → friendly "retake" message 👤🤖
- [ ] 🟠 Not a food label (e.g. a book) → "couldn't read a food label" 👤
- [ ] 🟠 Tamil / Hindi printed label 👤
- [ ] 🟠 Expired product → AVOID 👤
- [ ] 🟠 Allergen packet with a nut-allergy profile → red alert + AVOID 👤
- [ ] 🟡 Slow network: loading state, no crash 👤

---

## 3. Demo

### 3.1 Setup
- [ ] 🔴 Demo account A: **diabetic on sugar cut** (with a sample report uploaded) 👤
- [ ] 🔴 Demo account B: **gym / muscle gain** 👤
- [ ] 🔴 5 "problem packets" with misleading claims (photos in `problem-packets/` + README table) 👤
- [ ] 🔴 Pre-scan all 5 on both accounts and confirm the verdicts flip as expected 👤
- [ ] 🔴 Backup video of the full flow (in case Wi-Fi fails) 👤
- [ ] 🟠 Phone hotspot as backup internet 👤
- [ ] 🟠 Phone brightness up, screen mirroring tested 👤

### 3.2 Pitch (3 minutes)
- [ ] 🔴 0:00 Hook: hold up a packet: "This says *No added sugar*. Would you trust it?"
- [ ] 🔴 0:30 Problem: labels are tiny, technical and misleading; diabetics and allergy families are guessing
- [ ] 🔴 0:50 Live: "Sir/Madam, give me any packet": scan the judge's own packet
- [ ] 🔴 1:50 Wow: switch to account B, same packet, verdict changes; play the Tamil voice
- [ ] 🔴 2:20 One architecture slide: vision AI + deterministic engine + personal rulebook (+ RAG)
- [ ] 🔴 2:40 Impact + accuracy number; close: "Scan. Understand. Choose better."
- [ ] 🔴 Rehearse 3 times with a timer 👤

### 3.3 Judge Q&A answers ready
- [ ] 🔴 "Won't the AI hallucinate?" → code computes all numbers; AI only reads and explains; allergens/expiry are hard rules
- [ ] 🔴 "Privacy?" → row-level security, private buckets, keys server-side, delete-my-data
- [ ] 🔴 "How accurate?" → measured on N real packets: X%
- [ ] 🟠 "How is this different from barcode apps?" → reads the label itself (works for local brands), personalised to your body, catches lying claims
- [ ] 🟠 "Scale / cost?" → serverless (Supabase + Gemini Flash); per-scan cost: _check current Gemini Flash pricing before quoting a number_

---

## 4. Changes (log)

| Date | Change | Why |
|---|---|---|
| 26 Nov | Hosting: GitHub Pages (static export) instead of Vercel | Keep everything on GitHub |
| 26 Nov | Diet type single-choice incl. **Non-vegetarian**, with definitions; extra diet rules (halal, no beef, no onion/garlic) | User feedback |
| 26 Nov | Health paragraph made **optional** | User feedback |
| 26 Nov | Fixed: report step skipped (Continue button reuse submitted the form) | Bug |
| 26 Nov | Voice: **English + Tamil only** (no Hindi) | Hindi voice unavailable on test devices |
| 26 Nov | Full UI redesign with Motion (animated hero demo, sliding onboarding, count-ups, viewfinder) | User request |
| 26 Nov | Skipped `claude-dev` bridge; went straight to Gemini | Keys available; deadline |
| 26 Nov | Model `gemini-2.5-flash` → `gemini-flash-latest` with low thinking (104 s → 11 s) | 2.5 closed to new users; speed |
| 26 Nov | Light high-contrast app shell; fixed invisible header (stale dev-server CSS) | User feedback |
| 26 Nov | Embeddings: pgvector HNSW instead of FAISS (same ANN search, no extra server) | Serverless stack |
| 26 Nov | EMBED key returns 403 on embeddings; failover uses the other keys | Check that key's project |
| 26 Nov | 3 Gemini keys with failover across 3 models × 3 keys on 503/429 | Gemini overload during testing |

### Pending housekeeping
- [ ] 🔴 Rotate the 3 Gemini keys after the hackathon (they were shared in chat) 👤🤖
- [ ] 🟠 Delete test user `uploadtest.1795667083141@example.com` in Supabase → Authentication → Users 👤
- [ ] 🟡 Remove the test user's profile/scan rows (deleted automatically with the user) 👤
