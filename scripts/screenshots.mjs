// Captures every scene at desktop and phone size into screenshots/.
// Usage: node scripts/screenshots.mjs [baseUrl] [--flow]   (needs the app running; Playwright browsers installed)
//   --flow walks the whole demo: plan with "can't travel", approve, complete on the watch.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const flow = process.argv.includes("--flow");
const offlineRun = process.argv.includes("--offline"); // simulate the backend being down
const prefix = offlineRun ? "offline-" : "";
const sub = (process.argv.find((x) => x.startsWith("--out=")) ?? "").slice(6);
const out = fileURLToPath(new URL("../screenshots/" + (sub ? sub + "/" : ""), import.meta.url));
mkdirSync(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: out + prefix + name + ".png" });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
const sizes = [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]];
if (process.argv.includes("--wide")) sizes.unshift(["wide", { width: 1920, height: 1080 }]);
for (const [tag, viewport] of sizes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: tag === "phone" ? 2 : 1 });
  const page = await ctx.newPage();
  if (offlineRun) await page.route(/127\.0\.0\.1:8000|localhost:8000/, (r) => r.abort());
  page.on("console", (m) => { if (m.type() === "error") console.log(`[${tag}] console:`, m.text()); });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  await shot(page, `${tag}-01-intro`);
  await page.goto(base + "/patients/amina/360", { waitUntil: "networkidle" });
  await page.waitForSelector("#summary h1");
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(800);
  await shot(page, `${tag}-02-dashboard`);
  const go = async (id, name, extra = 0) => {
    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: "start" }), id);
    await page.waitForTimeout(700 + extra);
    await shot(page, `${tag}-${name}`);
  };
  await go("timeline", "03-timeline");
  await page.getByRole("button", { name: "See why it was flagged" }).first().click();
  await page.waitForTimeout(700);
  await shot(page, `${tag}-04-evidence`);
  await page.keyboard.press("Escape");
  await go("understand", "05-chamber", 3500);
  if (flow) {
    await page.getByRole("radio", { name: /advanced/i }).click();
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-05b-chamber-advanced`);
    await page.getByRole("button", { name: "Macula", exact: true }).click();
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-05c-chamber-macula`);
    await go("navigate", "06-navigate");
    await page.getByRole("button", { name: "I can't travel to appointments" }).click();
    await page.getByRole("button", { name: /find verified options/ }).click();
    await page.waitForTimeout(6000);
    await go("navigate", "07-replan");
    await page.getByRole("button", { name: "Prepare reminder to review" }).click();
    await page.waitForTimeout(800);
    await go("approve", "08-approve");
    await page.getByRole("button", { name: "Approve reminder" }).click();
    await page.waitForTimeout(1800);
    await go("approve", "09-awaiting");
    await go("health", "12-watch-reminder");
    await page.waitForTimeout(5200);
    await page.getByRole("switch", { name: /Blood pressure/ }).first().click();
    await page.getByRole("switch", { name: /Heart rate/ }).first().click();
    await page.waitForTimeout(600);
    await go("health", "12b-watch-question");
    await page.locator(".watch").getByRole("button", { name: /^Yes$/ }).click();
    await page.waitForTimeout(1600);
    await go("complete", "10-completed");
    await go("timeline", "10b-thread-joined", 400);
  } else {
    await go("navigate", "06-navigate");
    await go("health", "12-watch");
  }
  await go("review", "11-review");
  await ctx.close();
}
await browser.close();
console.log("Saved screenshots to", out);
