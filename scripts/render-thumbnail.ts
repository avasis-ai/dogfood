/**
 * render-thumbnail.ts — Playwright-based thumbnail renderer.
 *
 * Reads scripts/thumbnail/index.html, drives the 6-phase animation
 * by calling window.startAnimation(), captures a frame every 1/24s,
 * and writes PNG frames to scripts/thumbnail/frames/.
 *
 * Usage:
 *   pnpm exec tsx scripts/render-thumbnail.ts
 *
 * Outputs:
 *   scripts/thumbnail/frames/frame_0001.png ... frame_0408.png
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const FPS = 24;
const TOTAL_FRAMES = 408; // 17 seconds at 24fps
const WIDTH = 1200;
const HEIGHT = 675;

const SCRIPT_DIR = path.resolve(__dirname);
const HTML_PATH = path.join(SCRIPT_DIR, "thumbnail", "index.html");
const FRAMES_DIR = path.join(SCRIPT_DIR, "thumbnail", "frames");

/**
 * Capture frames by using Puppeteer-style direct CDP connection
 * via the system Playwright's chromium binary.
 */
async function main() {
  // Find an existing chromium binary
  const home = process.env.HOME ?? "";
  const possiblePaths = [
    path.join(home, "Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"),
    path.join(home, "Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell"),
  ];

  let chromiumPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      chromiumPath = p;
      break;
    }
  }

  if (!chromiumPath) {
    console.error("No chromium found. Run: npx playwright install chromium");
    process.exit(1);
  }

  console.log(`Using chromium: ${chromiumPath}`);

  // Ensure frames directory exists
  if (!fs.existsSync(FRAMES_DIR)) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  }

  // Clean old frames
  const existing = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith(".png"));
  for (const f of existing) {
    fs.unlinkSync(path.join(FRAMES_DIR, f));
  }

  console.log(`Rendering ${TOTAL_FRAMES} frames at ${FPS}fps (${WIDTH}×${HEIGHT})…`);

  // Use dynamic import so playwright uses the local binary
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath,
  });

  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Load the HTML file
  const htmlUrl = `file://${HTML_PATH}`;
  await page.goto(htmlUrl, { waitUntil: "networkidle" });

  // Start animation
  await page.evaluate(() => {
    (window as Record<string, unknown>).animationDone = false;
    (window as Record<string, () => void>).startAnimation();
  });

  // Capture frames
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const frameNum = String(i + 1).padStart(4, "0");
    const outPath = path.join(FRAMES_DIR, `frame_${frameNum}.png`);

    await page.screenshot({ path: outPath, type: "png" });

    // Wait for next frame tick
    await page.waitForTimeout(1000 / FPS);

    // Progress log every 48 frames (every 2 seconds of animation)
    if ((i + 1) % 48 === 0) {
      const done = await page.evaluate(
        () => (window as Record<string, unknown>).animationDone,
      );
      console.log(
        `  Frame ${i + 1}/${TOTAL_FRAMES} (${((i + 1) / FPS).toFixed(1)}s)${done ? " — done" : ""}`,
      );
    }

    // Stop early if animation finished
    const animDone = await page.evaluate(
      () => (window as Record<string, unknown>).animationDone,
    );
    if (animDone && i >= TOTAL_FRAMES - 1) break;
  }

  await browser.close();

  const frameCount = fs.readdirSync(FRAMES_DIR).filter((f) => f.endsWith(".png")).length;
  console.log(`Done: ${frameCount} frames written to ${FRAMES_DIR}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
