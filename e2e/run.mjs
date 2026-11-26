// End-to-end check of every feature on desktop + mobile, recording the demo video and screenshots.
// Usage: BASE=http://localhost:3000 DEMO_EMAIL=... DEMO_PASSWORD=... node e2e/run.mjs
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const OUT = path.resolve("e2e/out");
fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
const PK = path.resolve("problem-packets/unhealthy-prods");

const results = [];
async function step(device, name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    results.push({ device, name, ok: true, ms: Date.now() - t, note: note ?? "" });
    console.log(`✓ [${device}] ${name} (${Date.now() - t} ms) ${note ?? ""}`);
  } catch (e) {
    results.push({ device, name, ok: false, ms: Date.now() - t, note: String(e.message ?? e).split("\n")[0] });
    console.log(`✗ [${device}] ${name}: ${String(e.message ?? e).split("\n")[0]}`);
  }
}
const pause = (p, ms) => p.waitForTimeout(ms);
const shot = (p, name) => p.screenshot({ path: path.join(OUT, "shots", `${name}.png`) });

async function signIn(page, device, slow) {
  await page.goto(`${BASE}/login/`);
  await page.getByPlaceholder("you@example.com").waitFor();
  if (slow) {
    await page.getByPlaceholder("you@example.com").pressSequentially(EMAIL, { delay: 25 });
    await page.locator('input[type="password"]').pressSequentially(PASSWORD, { delay: 40 });
  } else {
    await page.getByPlaceholder("you@example.com").fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
  }
  await shot(page, `${device}-02-login`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/home\/?$/, { timeout: 30000 });
  await page.getByText("Your daily limits").waitFor({ timeout: 20000 });
}

async function scanFlow(page, device, files, slow) {
  await page.goto(`${BASE}/scan/`);
  await page.getByText("Check a packet").waitFor();
  await page.locator('input[type="file"][multiple]').setInputFiles(files);
  await page.getByRole("button", { name: new RegExp(`Analyse ${files.length} photo`) }).waitFor();
  if (slow) await pause(page, 1500);
  await shot(page, `${device}-05-scan-photos`);
  await page.getByRole("button", { name: new RegExp(`Analyse ${files.length} photo`) }).click();
  await page.locator("#scan-result").waitFor({ timeout: 150000 });
  await pause(page, 2500);
  const text = (await page.locator("#scan-result").innerText()) ?? "";
  const verdict = text.match(/\b(SAFE|LIMIT|AVOID)\b/)?.[1] ?? "unknown";
  await page.locator("#scan-result").scrollIntoViewIfNeeded();
  await shot(page, `${device}-06-result-top`);
  if (slow) {
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 420);
      await pause(page, 900);
    }
  } else {
    await page.mouse.wheel(0, 1600);
    await pause(page, 600);
  }
  await shot(page, `${device}-07-result-details`);
  return verdict;
}

async function run(device) {
  const isMobile = device === "mobile";
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const ctxOpts = isMobile
    ? { ...devices["iPhone 13"], permissions: ["camera"] }
    : { viewport: { width: 1440, height: 900 }, permissions: ["camera"] };
  if (!isMobile) ctxOpts.recordVideo = { dir: path.join(OUT, "video"), size: { width: 1440, height: 900 } };
  else ctxOpts.recordVideo = { dir: path.join(OUT, "video-mobile"), size: { width: 390, height: 844 } };
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const slow = !isMobile; // desktop run doubles as the demo video

  await step(device, "Landing page loads", async () => {
    await page.goto(`${BASE}/`);
    await page.getByText("safe for you").first().waitFor({ timeout: 20000 });
    await pause(page, slow ? 6500 : 1500); // let the animated scan demo play
    await shot(page, `${device}-01-landing`);
  });

  await step(device, "Email sign-in → Overview", () => signIn(page, device, slow));
  await step(device, "Overview shows limits, reports snapshot", async () => {
    await page.getByText("Health snapshot").waitFor();
    await pause(page, slow ? 2500 : 800);
    await shot(page, `${device}-03-overview`);
    if (slow) {
      await page.mouse.wheel(0, 700);
      await pause(page, 1800);
      await page.mouse.wheel(0, -700);
    }
    return (await page.getByText("HbA1c").count()) ? "lab values visible" : "no lab values shown";
  });

  await step(device, "Navigation (sidebar / bottom tabs / menu drawer)", async () => {
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("link", { name: "Health profile" }).waitFor();
      await shot(page, `${device}-04-menu`);
      await page.getByRole("button", { name: "Close menu" }).click();
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Docs" }).click();
    } else {
      await page.getByRole("link", { name: "Documents" }).first().click();
    }
    await page.getByText("Health documents").first().waitFor();
    await page.getByText("Analysed").first().waitFor({ timeout: 15000 });
    await pause(page, slow ? 3000 : 800);
    await shot(page, `${device}-04-documents`);
    return "documents page + analysed report";
  });

  await step(device, "View uploaded report (signed URL)", async () => {
    const [popup] = await Promise.all([page.waitForEvent("popup", { timeout: 15000 }), page.getByRole("button", { name: "View" }).first().click()]);
    await popup.waitForLoadState();
    const ok = popup.url().includes("/storage/v1/object/sign/");
    await popup.close();
    if (!ok) throw new Error("did not open a signed storage URL");
    return "opened private 2-min link";
  });

  await step(device, "Camera opens and captures (fake camera)", async () => {
    await page.goto(`${BASE}/scan/`);
    await page.getByRole("button", { name: "Open camera" }).click();
    await page.getByRole("button", { name: "Capture photo" }).waitFor({ timeout: 10000 });
    await pause(page, 1200);
    await page.getByRole("button", { name: "Capture photo" }).click();
    await page.getByRole("button", { name: "Remove photo 1" }).waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: "Done with camera" }).click();
    await page.getByRole("button", { name: "Remove photo 1" }).click();
    return "photo added to tray, then removed";
  });

  const files = isMobile
    ? [path.join(PK, "britannia-milk-bikis-biscuits-back.webp"), path.join(PK, "britannia-milk-bikis-biscuits.webp")]
    : [path.join(PK, "lays-back.jpg"), path.join(PK, "lays-front.jpg")];
  let verdict;
  await step(device, `Multi-photo scan (${files.length} photos) → verdict`, async () => {
    const t = Date.now();
    verdict = await scanFlow(page, device, files, slow);
    return `${verdict} in ${Math.round((Date.now() - t) / 1000)} s`;
  });

  await step(device, "Ask about this product (uses reports)", async () => {
    const card = page.getByText("Ask about this product").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await card.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "How many pieces are safe for me today?" }).click();
    await page.getByText(/Based on \d+ excerpts|No report data used/).first().waitFor({ timeout: 60000 });
    await pause(page, slow ? 4000 : 800);
    await card.scrollIntoViewIfNeeded();
    await shot(page, `${device}-08-ask`);
    return (await page.getByText(/Based on \d+ excerpts/).count()) ? "answer used report excerpts" : "answer without reports";
  });

  await step(device, "Assistant chat (personalised)", async () => {
    await page.goto(`${BASE}/assistant/`);
    await page.getByText("Ask SmartPack").waitFor();
    const input = page.getByPlaceholder("Ask about any food, meal or product…");
    if (slow) await input.pressSequentially("What should I eat for an evening snack?", { delay: 30 });
    else await input.fill("Suggest a breakfast that fits my limits");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText("Used your reports").first().waitFor({ timeout: 60000 });
    await pause(page, slow ? 5000 : 800);
    await shot(page, `${device}-09-assistant`);
    return "reply used reports";
  });

  await step(device, "History list + open scan detail", async () => {
    await page.goto(`${BASE}/history/`);
    await page.getByText("Every packet you've checked").waitFor();
    await page.getByRole("button", { name: /AVOID|LIMIT|SAFE/ }).first().waitFor({ timeout: 15000 });
    await pause(page, slow ? 2000 : 600);
    await shot(page, `${device}-10-history`);
    await page.getByRole("button", { name: /AVOID|LIMIT|SAFE/ }).first().click();
    await page.getByText("Why, for you").waitFor({ timeout: 15000 });
    await pause(page, slow ? 2500 : 600);
    return "detail reopened";
  });

  await step(device, "Health profile (edit) loads with saved values", async () => {
    await page.goto(`${BASE}/onboarding/`);
    await page.getByText("About you").first().waitFor();
    const name = await page.locator('input[autocomplete="name"]').inputValue();
    await shot(page, `${device}-11-profile`);
    if (name !== "Arun Kumar") throw new Error(`name field = ${name}`);
    return "prefilled";
  });

  await step(device, "Contact page loads", async () => {
    await page.goto(`${BASE}/contact/`);
    await page.getByText("Contact the team").waitFor();
    await shot(page, `${device}-12-contact`);
  });

  await step(device, "Sign out", async () => {
    await page.goto(`${BASE}/home/`);
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("button", { name: "Sign out" }).last().click();
    } else {
      await page.getByRole("button", { name: "Sign out" }).first().click();
    }
    await page.waitForURL(/\/login\/?$/, { timeout: 15000 });
  });

  results.push({ device, name: "Browser console errors", ok: errors.length === 0, ms: 0, note: errors.slice(0, 5).join(" | ") });
  await ctx.close();
  await browser.close();
}

const which = process.argv[2] ?? "both";
if (which !== "mobile") await run("desktop");
if (which !== "desktop") await run("mobile");
fs.writeFileSync(path.join(OUT, `results-${which}.json`), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(0);
