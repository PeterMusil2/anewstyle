#!/usr/bin/env bun
/**
 * Watermark asset + previews.
 *
 *   bun scripts/watermark.ts
 *     public/images/logos/watermark.svg → public/admin/watermark.png
 *     (transparent, 1600 px tall, opacity from the SVG baked in). The CMS
 *     worker and scripts/image-set.ts both draw this one PNG, so uploads and
 *     bulk imports look the same.
 *
 *   bun scripts/watermark.ts preview <out-dir> <file-or-url>... [--360 <file-or-url>...]
 *     Bakes the mark into photos the way an upload will (full size, then
 *     downscaled) and writes 1600 px JPEGs to look at. Inputs after --360 are
 *     placed as panoramas.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import sharp from "sharp";
import type { ImageKind } from "../src/lib/image-pipeline";
import { applyWatermark, load } from "./image-set";

const SVG = resolve("public/images/logos/watermark.svg");
const PNG = resolve("public/admin/watermark.png");
const PNG_HEIGHT = 1600;

async function renderPng() {
  const svg = await readFile(SVG);
  // density scales the 850 px SVG to the target height before rasterising.
  const png = await sharp(svg, { density: (72 * PNG_HEIGHT) / 850 })
    .resize({ height: PNG_HEIGHT })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(PNG, png);
}

async function preview(outDir: string, args: string[]) {
  await mkdir(outDir, { recursive: true });
  let kind: ImageKind = "photo";
  for (const arg of args) {
    if (arg === "--360") {
      kind = "360";
      continue;
    }
    const original = await sharp(await load(arg)).rotate().toBuffer();
    const marked = await applyWatermark(original, kind);
    const name = basename(arg.split("?")[0]).replace(/\.[a-z0-9]+$/i, "");
    const out = resolve(outDir, `${name}.jpg`);
    await sharp(marked).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(out);
    console.log(`✓ ${out}`);
  }
}

const [command, outDir, ...inputs] = process.argv.slice(2);
if (command === "preview") {
  if (!outDir || !inputs.length) {
    console.error("Usage: bun scripts/watermark.ts preview <out-dir> <file-or-url>... [--360 <file-or-url>...]");
    process.exit(1);
  }
  await preview(outDir, inputs);
} else {
  await renderPng();
  console.log(`✓ ${PNG}`);
}
