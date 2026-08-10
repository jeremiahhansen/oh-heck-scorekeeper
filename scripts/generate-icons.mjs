/**
 * Renders public/icon.svg into the PNG sizes iOS and the PWA manifest need.
 * The PNGs are build output, not source, so they are gitignored.
 *
 *   npm run icons
 */

import { readFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/icon.svg";

const TARGETS = [
  { file: "public/pwa-192x192.png", size: 192 },
  { file: "public/pwa-512x512.png", size: 512 },
  // iOS uses this one for the home screen.
  { file: "public/apple-touch-icon.png", size: 180 },
  { file: "public/favicon.png", size: 48 },
];

const svg = await readFile(SOURCE);

for (const { file, size } of TARGETS) {
  // High density so the small sizes rasterize from a crisp source.
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(file);
  console.log(`wrote ${file} (${size}x${size})`);
}
