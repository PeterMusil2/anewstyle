/**
 * Gallery image pipeline rules – one source for the CMS (browser) and the Bun
 * scripts, so uploads and bulk imports produce the same files.
 *
 *   public/media/<images|360>/<name>-<width>.avif
 *
 * - Widths per kind, never upscaled (widthsFor).
 * - Watermark: public/admin/watermark.png (rendered with its opacity from
 *   public/images/logos/watermark.svg by scripts/watermark.ts), centred and
 *   drawn once on the full-size photo, before any resize, so every width
 *   carries the same mark.
 *
 * Browser-safe (no Node APIs): bundled into public/admin/pipeline-core.js by
 * `bun run admin:build` for the CMS image worker.
 */

export type ImageKind = "photo" | "360";

export const WIDTHS: Record<ImageKind, number[]> = {
  photo: [400, 800, 1200, 1800],
  // Tile, phones, desktop viewer (Cloudinary served panoramas at 4096 too).
  "360": [800, 2048, 4096],
};

/** AVIF quality (0–100) for both encoders. */
export const AVIF_QUALITY = 55;

/**
 * Widths to generate for an original of `width` px: never upscale, and skip a
 * standard width the original barely exceeds (1225 px → 400, 800, 1225).
 */
export function widthsFor(width: number, kind: ImageKind = "photo"): number[] {
  const standard = WIDTHS[kind];
  if (width > standard.at(-1)!) return standard;
  return [...standard.filter((w) => w * 1.18 <= width), width];
}

/** Width ÷ height of watermark.svg (365 × 850). */
export const WATERMARK_ASPECT = 365 / 850;

/**
 * Share of the photo height the mark takes, and of the width at most.
 * Panoramas get less: 18 % of an equirectangular image is ~32° of the
 * sphere, so the mark sits in the first view without filling it.
 */
const MARK_SIZE: Record<ImageKind, { height: number; maxWidth: number }> = {
  photo: { height: 0.4, maxWidth: 0.3 },
  "360": { height: 0.18, maxWidth: 0.05 },
};

export interface WatermarkBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function placeWatermark(width: number, height: number, kind: ImageKind = "photo"): WatermarkBox {
  const size = MARK_SIZE[kind];
  let h = height * size.height;
  let w = h * WATERMARK_ASPECT;
  if (w > width * size.maxWidth) {
    w = width * size.maxWidth;
    h = w / WATERMARK_ASPECT;
  }
  w = Math.round(w);
  h = Math.round(h);
  return { left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h };
}

/** Bakes the mark into a canvas that holds the full-size photo. */
export function drawWatermark(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  mark: CanvasImageSource,
  kind: ImageKind = "photo",
) {
  const box = placeWatermark(ctx.canvas.width, ctx.canvas.height, kind);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mark, box.left, box.top, box.width, box.height);
}

/** Tile shape the gallery crops a photo to (panoramas use the landscape tile). */
export const tileRatio = (width: number, height: number) => (height > width ? 9 / 16 : 16 / 9);
