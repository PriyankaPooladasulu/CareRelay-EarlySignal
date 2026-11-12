// Captures the original procedural eye in each educational state to public/images/eye/{state}.png.
// These PNGs are the no-WebGL fallback. Usage: node scripts/capture-eye.mjs [baseUrl]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = fileURLToPath(new URL("../public/images/eye/", import.meta.url));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
await page.goto(base + "/patients/amina/360", { waitUntil: "networkidle" });
await page.evaluate(() => document.getElementById("understand")?.scrollIntoView({ block: "start" }));
await page.waitForSelector("#understand canvas");
await page.addStyleTag({ content: "#understand .overflow-hidden.rounded-full button { display: none !important; }" });
await page.waitForTimeout(3000);
for (const [state, label] of [["normal", /^Normal$/], ["early", /early/i], ["progressing", /progressing/i], ["advanced", /advanced/i]]) {
  await page.getByRole("radio", { name: label }).click();
  await page.waitForTimeout(2200);
  await page.locator("#understand canvas").first().screenshot({ path: out + state + ".png" });
  console.log("captured", state);
}
await browser.close();
