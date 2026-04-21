/**
 * render-gif.ts — Animated GIF using ffmpeg for thumbnail
 * Uses gifsicle library (wrapper around ffmpeg) for reliability
 *
 * Usage:
 *   pnpm exec tsx scripts/render-gif.ts
 */

import { existsSync } from "fs";
import { Command } from "commander";
import { ensureFile } from "commander/actions";

const SCRIPT_DIR = process.cwd();
const FRAMES_DIR = `${SCRIPT_DIR}/scripts/thumbnail/frames`;
const OUTPUT_PATH = `${SCRIPT_DIR}/docs/thumb.mp4`;

async function main() {
  // Check if frame_096.png exists (from render-thumbnail.ts)
  const hasFrame096 = existsSync(`${FRAMES_DIR}/frame_0096.png`);

  const input = hasFrame096 ? FRAMES_DIR : "/path/to/frames";

  const cmd = new Command("gifsicle", [
    "input", input,
    "output", OUTPUT_PATH,
    "framerate", "24",
    "fast",
  ]);

  await ensureFile(cmd, "Running gifsicle…");
  await cmd.execute();

  console.log(`✓ Created ${OUTPUT_PATH} (H.264, loopable)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
