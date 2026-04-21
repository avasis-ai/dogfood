/**
 * capture-frame.ts — Captures a single frame as a static PNG
 * from the rendered thumbnail frames directory. Used as a fallback
 * if docs/thumb.gif generation or ffmpeg encoding fails.
 *
 * Usage:
 *   pnpm exec tsx scripts/capture-frame.ts
 */

import * as fs from "fs";
import { createCanvas, loadImage } from "canvas";

const SCRIPT_DIR = process.cwd();
const FRAMES_DIR = SCRIPT_DIR.endsWith("/scripts")
  ? SCRIPT_DIR + "/scripts"
  : SCRIPT_DIR.replace(/\/$/, "/scripts");

const TARGET_INDEX = 96; // Capture frame 96 of 408
const INPUT_DIR = process.env.FRAMES_DIR ?? FRAMES_DIR;

async function main() {
  const inputFile = `${INPUT_DIR}/frame_${String(TARGET_INDEX).padStart(4, "0")}.png`;

  if (fs.existsSync(inputFile)) {
    console.log(`Frame ${TARGET_INDEX} already exists: ${inputFile}`);
    process.exit(0);
  }

  const img = await loadImage(inputFile);
  const canvas = createCanvas(1200, 675);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 1200, 675);
  ctx.drawImage(img, 0, 0, 1200, 675);

  const outFile = `${SCRIPT_DIR}/frame-fallback.png`;
  const out = fs.createWriteStream(outFile);

  canvas.createPNGStream().pipe(out);

  console.log(`✓ Captured frame ${TARGET_INDEX} → ${outFile}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
