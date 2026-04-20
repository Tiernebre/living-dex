#!/usr/bin/env node
// Usage: node scripts/screenshot.mjs [url] [outPath] [--full] [--width=1280] [--height=800]
// Defaults: url=http://localhost:5173  outPath=./screenshot.png
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? true];
    }),
);

const url = positional[0] ?? "http://localhost:5173";
const outPath = resolve(positional[1] ?? "./screenshot.png");
const width = Number(flags.width ?? 1280);
const height = Number(flags.height ?? 800);
const fullPage = Boolean(flags.full);

await mkdir(dirname(outPath), { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();

const consoleMsgs = [];
page.on("console", (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleMsgs.push(`[pageerror] ${err.message}`));

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
} catch (err) {
  console.error(`Failed to load ${url}: ${err.message}`);
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: outPath, fullPage });
await browser.close();

console.log(`Saved ${outPath}`);
if (consoleMsgs.length) {
  console.log("--- console ---");
  for (const m of consoleMsgs) console.log(m);
}
