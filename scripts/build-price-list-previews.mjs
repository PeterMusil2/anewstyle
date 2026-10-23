/**
 * Rebuild the four price-list panel previews with the supplied stone decor.
 * The existing AVIF alpha masks preserve each panel's width and outline.
 * Run with: node scripts/build-price-list-previews.mjs
 */
import sharp from "sharp";

sharp.cache(false);
sharp.concurrency(1);

const sizes = ["l", "xl", "xxl", "xxxl"];
const sourcePath = "public/images/priceList/art-stone.png";

for (const size of sizes) {
  const maskPath = `public/images/priceList/${size}.avif`;
  const outputPath = `public/images/priceList/${size}-art-stone.avif`;
  const { data: mask, info } = await sharp(maskPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (mask[(y * info.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    throw new Error(`No visible panel shape found in ${outputPath}.`);
  }

  const panelWidth = right - left + 1;
  const panelHeight = bottom - top + 1;
  const { data: texture } = await sharp(sourcePath)
    .resize(panelWidth, panelHeight, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.alloc(info.width * info.height * 4);
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const outputIndex = (y * info.width + x) * 4;
      const textureIndex = ((y - top) * panelWidth + (x - left)) * 3;
      output[outputIndex] = texture[textureIndex];
      output[outputIndex + 1] = texture[textureIndex + 1];
      output[outputIndex + 2] = texture[textureIndex + 2];
      output[outputIndex + 3] = mask[outputIndex + 3];
    }
  }

  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .avif({ quality: 70, effort: 4 })
    .toFile(outputPath);

  console.log(`Updated ${size.toUpperCase()} preview (${panelWidth}×${panelHeight} panel).`);
}
