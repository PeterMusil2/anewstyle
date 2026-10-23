/**
 * Build-time responsive images.
 *
 * For every raster image in the folders below, writes AVIF and WebP copies
 * at a few widths to public/_img/<same path>-<width>.<format> and a manifest
 * (src/data/image-manifest.json) that <Picture> uses to build srcsets.
 *
 * Existing outputs are kept, so a build only encodes images that are new or
 * changed (the outputs are committed). Run: node scripts/optimize-images.mjs
 */
import { readdir, stat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep memory flat on small build machines.
sharp.cache(false);
sharp.concurrency(1);

const ROOT = path.join(process.cwd(), "public");
const OUT = path.join(ROOT, "_img");
const MANIFEST = path.join(process.cwd(), "src", "data", "image-manifest.json");
const FOLDERS = ["images/products", "images/showcase", "images/before-after", "images/backgrounds", "images/technologies", "images/patterns", "downloads/Manual_AnewStyle_Basic_Deluxe.jpg"];
const WIDTHS = [400, 640, 960, 1280];
// AVIF encoding is the slow part of a build; effort 3 is a good size/speed
// trade-off and outputs are reused across builds (they are committed).
const RASTER = /\.(webp|png|jpe?g|avif)$/i;

// Product cards only show the lit photo; the other product photos are
// lightbox slides served as they are.
const products = JSON.parse(await readFile(path.join(process.cwd(), "src", "data", "products.json"), "utf8"));
const cardPhotos = new Set(products.items.map((item) => item.imgLight));
const QUALITY = { avif: 55, webp: 76 };

async function* walk(dir) {
  if (RASTER.test(dir)) {
    yield dir;
    return;
  }
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (RASTER.test(entry.name)) yield full;
  }
}

const exists = (file) => stat(file).then((s) => s.mtimeMs, () => 0);

let encoded = 0;
const next = {};
for (const folder of FOLDERS) {
  for await (const file of walk(path.join(ROOT, folder))) {
    const rel = "/" + path.relative(ROOT, file).split(path.sep).join("/");
    if (rel.startsWith("/images/products/") && !cardPhotos.has(rel)) continue;
    const meta = await sharp(file).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    // Never upscale; the largest variant is the original or 1280 px.
    const max = Math.min(width, WIDTHS.at(-1));
    const widths = [...new Set([...WIDTHS.filter((w) => w < max), max])];
    const base = rel.replace(RASTER, "");
    const srcMtime = await exists(file);
    const variants = { avif: [], webp: [] };

    for (const w of widths) {
      for (const format of ["avif", "webp"]) {
        const outRel = `/_img${base}-${w}.${format}`;
        const outFile = path.join(ROOT, outRel);
        const outMtime = await exists(outFile);
        if (!outMtime || outMtime < srcMtime) {
          await mkdir(path.dirname(outFile), { recursive: true });
          await sharp(file)
            .resize({ width: w, withoutEnlargement: true })
            [format]({ quality: QUALITY[format], effort: format === "avif" ? 3 : 4 })
            .toFile(outFile);
          encoded++;
        }
        variants[format].push([outRel, w]);
      }
    }
    next[rel] = { width, height, ...variants };
  }
}

await mkdir(OUT, { recursive: true });
await writeFile(MANIFEST, JSON.stringify(next, null, 1) + "\n");
console.log(`✓ Responsive images: ${Object.keys(next).length} sources, ${encoded} new variants → public/_img`);
