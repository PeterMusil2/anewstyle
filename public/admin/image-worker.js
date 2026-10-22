/**
 * Image worker (module) – one photo → watermarked AVIF files in fixed widths.
 *
 * Runs off the main thread so the CMS stays responsive. Decodes the file
 * (EXIF orientation applied, metadata dropped), takes a small clean preview
 * for the focus point, bakes the watermark into the full-size photo, then
 * downsizes with Lanczos3 and encodes each width with the AVIF codec from
 * Squoosh (jSquash, vendored). Widths, quality and mark placement come from
 * pipeline-core.js (built from src/lib/image-pipeline.ts).
 *
 * In:  { id, file, kind: "photo" | "360" }
 * Out: { id, type: "progress", done, total }
 *      { id, type: "done", width, height, files: [{ width, buffer }], preview }
 *      { id, type: "error", message }
 */
import encode from "./vendor/jsquash-avif/encode.js";
import initResize, { resize } from "./vendor/squoosh-resize/squoosh_resize.js";
import { AVIF_QUALITY, WIDTHS, drawWatermark, widthsFor } from "./pipeline-core.js";

const resizeReady = initResize();
const LANCZOS3 = 3;
const PREVIEW_WIDTH = 480;

let markPromise;
const watermark = () =>
  (markPromise ??= fetch(new URL("watermark.png", import.meta.url))
    .then((res) => {
      if (!res.ok) throw new Error(`watermark.png: HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => createImageBitmap(blob)));

async function scale(image, width) {
  if (width >= image.width) return image;
  await resizeReady;
  const height = Math.round((image.height * width) / image.width);
  const out = resize(new Uint8Array(image.data.buffer), image.width, image.height, width, height, LANCZOS3, true, true);
  return new ImageData(new Uint8ClampedArray(out.buffer), width, height);
}

self.onmessage = async ({ data: { id, file, kind = "photo" } }) => {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    const min = WIDTHS[kind][0];
    if (width < min) {
      bitmap.close();
      throw new Error(`too-small:${width}:${min}`);
    }
    if (kind === "360" && Math.abs(width / height - 2) > 0.02) {
      bitmap.close();
      throw new Error(`not-2-1:${width}x${height}`);
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Clean preview first, so the mark never attracts the focus point.
    const preview = await scale(ctx.getImageData(0, 0, width, height), Math.min(PREVIEW_WIDTH, width));
    drawWatermark(ctx, await watermark(), kind);
    const original = ctx.getImageData(0, 0, width, height);

    const widths = widthsFor(width, kind);
    const files = [];
    for (const [index, w] of widths.entries()) {
      self.postMessage({ id, type: "progress", done: index, total: widths.length });
      const image = await scale(original, w);
      const buffer = await encode(image, { quality: AVIF_QUALITY, speed: 6, subsample: 1 });
      files.push({ width: w, buffer });
    }
    self.postMessage(
      { id, type: "done", width, height, files, preview },
      files.map((f) => f.buffer),
    );
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || String(error) });
  }
};
