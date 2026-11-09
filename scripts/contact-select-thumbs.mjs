/**
 * Small preview thumbnails for the contact form's custom selects.
 *
 * The price list previews (public/images/priceList/*.avif) are 512×1024 canvases
 * where the panel only fills part of the width – narrow for L, full for XXXL –
 * so the transparent/white margin carries the size. This script trims that
 * margin and writes ~56 px tall WebP thumbnails, so the dropdown shows the real
 * panel proportions for a few hundred bytes instead of 60–180 KB per option.
 *
 *   bun scripts/contact-select-thumbs.mjs
 *
 * Output: public/images/priceList/thumb/<size>[-art-stone].webp
 */
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/images/priceList";
const OUTPUT = `${SOURCE}/thumb`;
const HEIGHT = 112; // 2× the 56 px display height, for sharp edges on hi-dpi screens
const NAMES = ["l", "xl", "xxl", "xxxl"].flatMap((size) => [size, `${size}-art-stone`]);

await mkdir(OUTPUT, { recursive: true });

for (const name of NAMES) {
  const source = `${SOURCE}/${name}.avif`;
  const trimmed = await sharp(source).trim({ threshold: 12 }).toBuffer();
  const info = await sharp(trimmed)
    .resize({ height: HEIGHT })
    .webp({ quality: 78, effort: 6 })
    .toFile(`${OUTPUT}/${name}.webp`);
  console.log(`${name}: ${info.width}×${info.height}, ${info.size} B`);
}
