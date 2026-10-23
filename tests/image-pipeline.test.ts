/**
 * Gallery image rules shared by the CMS worker and scripts/image-set.ts.
 */
import { describe, expect, test } from "bun:test";
import { placeWatermark, WATERMARK_ASPECT, WIDTHS, widthsFor } from "../src/lib/image-pipeline";

describe("widthsFor", () => {
  test("large originals get every standard width", () => {
    expect(widthsFor(5000, "photo")).toEqual(WIDTHS.photo);
    expect(widthsFor(8000, "360")).toEqual(WIDTHS["360"]);
  });

  test("never upscales and ends with the original width", () => {
    expect(widthsFor(1280, "photo")).toEqual([400, 800, 1280]);
    expect(Math.max(...widthsFor(1280, "photo"))).toBe(1280);
  });

  test("skips a standard width the original barely exceeds (18 % rule)", () => {
    expect(widthsFor(900, "photo")).toEqual([400, 900]);
  });

  test("photos stop at 1800 px", () => {
    expect(Math.max(...widthsFor(4032, "photo"))).toBe(1800);
  });
});

describe("placeWatermark", () => {
  test("centred, keeps the logo aspect ratio", () => {
    const box = placeWatermark(2400, 1350, "photo");
    expect(box.left + box.width / 2).toBeCloseTo(1200, 0);
    expect(box.top + box.height / 2).toBeCloseTo(675, 0);
    expect(box.width / box.height).toBeCloseTo(WATERMARK_ASPECT, 1);
  });

  test("photo mark is 40 % of the height, capped at 30 % of the width", () => {
    expect(placeWatermark(2400, 1350, "photo").height).toBe(540);
    const narrow = placeWatermark(400, 2000, "photo");
    expect(narrow.width).toBeLessThanOrEqual(120);
  });

  test("panorama mark is smaller (18 % of the height)", () => {
    expect(placeWatermark(4096, 2048, "360").height).toBe(Math.round(2048 * 0.18));
  });
});
