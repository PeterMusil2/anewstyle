#!/usr/bin/env bun
/**
 * Image sets: one photo → watermarked AVIF files in fixed widths.
 *
 *   public/media/<images|360>/<name>-<width>.avif
 *
 * The website reads the widths and dimensions from the files themselves
 * (src/lib/image-set.ts), so content only stores the base path. The CMS does
 * the same in the browser (public/admin/image-worker.js); this is the
 * server-side twin for bulk imports and migrations. Both follow the rules in
 * src/lib/image-pipeline.ts.
 *
 * CLI:  bun scripts/image-set.ts <file-or-url> <base> [photo|360]
 *       e.g. bun scripts/image-set.ts ~/kuchyne.jpg /media/images/kuchyne
 * API:  makeImageSet(input, base, { kind }) → { src, width, height, widths, focus }
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import { AVIF_QUALITY, placeWatermark, tileRatio, widthsFor, type ImageKind } from "../src/lib/image-pipeline";

export interface Focus {
  x: number;
  y: number;
}

export interface ImageSetResult {
  src: string;
  width: number;
  height: number;
  widths: number[];
  focus: Focus;
}

const MARK = resolve("public/admin/watermark.png");
let markPromise: Promise<Buffer> | undefined;

export async function load(input: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(input)) return input;
  if (/^https?:\/\//.test(input)) {
    const res = await fetch(input);
    if (!res.ok) throw new Error(`${input}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(input);
}

/** Full-size photo (EXIF orientation baked in) → same photo with the mark. */
export async function applyWatermark(buffer: Buffer, kind: ImageKind = "photo"): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(buffer).metadata();
  const box = placeWatermark(width, height, kind);
  const mark = await sharp(await (markPromise ??= readFile(MARK)))
    .resize({ width: box.width, height: box.height, fit: "fill", kernel: "lanczos3" })
    .toBuffer();
  return sharp(buffer).composite([{ input: mark, left: box.left, top: box.top }]).toBuffer();
}

/** Focus point (percent) = centre of the best crop in the gallery tile shape. */
async function focusOf(buffer: Buffer, width: number, height: number, kind: ImageKind): Promise<Focus> {
  if (kind === "360") return { x: 50, y: 50 };
  const ratio = tileRatio(width, height);
  const side = Math.min(width, height * ratio);
  const { topCrop } = await smartcrop.crop(buffer, { width: Math.round(side), height: Math.round(side / ratio) });
  return {
    x: Math.round(((topCrop.x + topCrop.width / 2) / width) * 100),
    y: Math.round(((topCrop.y + topCrop.height / 2) / height) * 100),
  };
}

export async function makeImageSet(
  input: string | Buffer,
  base: string,
  { kind = "photo", watermark = true, root = "public" }: { kind?: ImageKind; watermark?: boolean; root?: string } = {},
): Promise<ImageSetResult> {
  // Bake EXIF orientation in, drop all metadata.
  const original = await sharp(await load(input)).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(original).metadata();
  // Focus from the clean photo, so the mark never attracts the crop.
  const focus = await focusOf(original, width, height, kind);
  const marked = watermark ? await applyWatermark(original, kind) : original;
  const widths = widthsFor(width, kind);
  await mkdir(dirname(resolve(root, `.${base}`)), { recursive: true });
  for (const w of widths) {
    const out = await sharp(marked)
      .resize({ width: w, kernel: "lanczos3" })
      .avif({ quality: AVIF_QUALITY, effort: 4, chromaSubsampling: "4:2:0" })
      .toBuffer();
    await writeFile(resolve(root, `.${base}-${w}.avif`), out);
  }
  return { src: base, width, height, widths, focus };
}

if (import.meta.main) {
  const [input, base, kind = "photo"] = process.argv.slice(2);
  if (!input || !base?.startsWith("/media/") || (kind !== "photo" && kind !== "360")) {
    console.error("Usage: bun scripts/image-set.ts <file-or-url> </media/<images|360>/name> [photo|360]");
    process.exit(1);
  }
  console.log(JSON.stringify(await makeImageSet(input, base, { kind })));
}
