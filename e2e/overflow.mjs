// Finds elements wider than the phone screen on each page.
import { chromium, devices } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto(`${BASE}/login/`);
await page.getByPlaceholder("you@example.com").fill(process.env.DEMO_EMAIL);
await page.locator('input[type="password"]').fill(process.env.DEMO_PASSWORD);
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.getByText("Your daily limits").waitFor({ timeout: 30000 });
for (const p of ["/", "/home/", "/scan/", "/assistant/", "/history/", "/documents/", "/onboarding/", "/contact/"]) {
  if (p === "/") continue;
  await page.goto(`${BASE}${p}`);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.right > vw + 1 && b.width > 0 && getComputedStyle(el).position !== "fixed";
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} right=${Math.round(el.getBoundingClientRect().right)}`)
      .slice(0, 4);
    return { vw, sw, offenders };
  });
  console.log(p, r.sw > r.vw ? `OVERFLOW ${r.sw}>${r.vw}` : "ok", r.sw > r.vw ? JSON.stringify(r.offenders) : "");
}
await browser.close();
