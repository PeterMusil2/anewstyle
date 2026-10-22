// Generated from src/lib/image-pipeline.ts by bun run admin:build - do not edit.

// src/lib/image-pipeline.ts
var WIDTHS = {
  photo: [400, 800, 1200, 1800],
  "360": [800, 2048, 4096]
};
var AVIF_QUALITY = 55;
function widthsFor(width, kind = "photo") {
  const standard = WIDTHS[kind];
  if (width > standard.at(-1))
    return standard;
  return [...standard.filter((w) => w * 1.18 <= width), width];
}
var WATERMARK_ASPECT = 365 / 850;
var MARK_SIZE = {
  photo: { height: 0.4, maxWidth: 0.3 },
  "360": { height: 0.18, maxWidth: 0.05 }
};
function placeWatermark(width, height, kind = "photo") {
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
function drawWatermark(ctx, mark, kind = "photo") {
  const box = placeWatermark(ctx.canvas.width, ctx.canvas.height, kind);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mark, box.left, box.top, box.width, box.height);
}
var tileRatio = (width, height) => height > width ? 9 / 16 : 16 / 9;
export {
  AVIF_QUALITY,
  WATERMARK_ASPECT,
  WIDTHS,
  drawWatermark,
  placeWatermark,
  tileRatio,
  widthsFor
};
