/**
 * Content the site depends on: what the CMS saves must render.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import cms from "../src/data/gallery-cms.json";
import prices from "../src/data/prices.json";
import products from "../src/data/products.json";
import { faqItems } from "../src/lib/faq";
import { getGalleryItems } from "../src/lib/gallery";

const toNumber = (value: string) => Number(value.replace(/\s/g, ""));
const SIZES = ["l", "xl", "xxl", "xxxl"] as const;
const publicFile = (path: string) => existsSync(`public${path}`);

describe("gallery", () => {
  test("every visible CMS entry renders (image set or Cloudinary video)", () => {
    const visible = cms.media.filter((entry) => !entry.hidden);
    expect(getGalleryItems().length).toBe(visible.length);
  });

  test("photos and panoramas are repo image sets, videos stay on Cloudinary", () => {
    for (const entry of cms.media) {
      const isSet = /^\/media\/(images|360)\/[^.]+$/.test(entry.media);
      const isVideo = /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(entry.media);
      expect(isSet || isVideo, entry.media).toBe(true);
    }
  });

  test("tiles and lightbox point at files that exist", () => {
    for (const item of getGalleryItems()) {
      if (item.type === "video") continue;
      expect(publicFile(item.tile.src), item.tile.src).toBe(true);
      expect(publicFile(item.full), item.full).toBe(true);
    }
  });
});

describe("price list", () => {
  test("every version has a positive price for every size", () => {
    for (const product of prices.products) {
      for (const size of SIZES) expect(toNumber(product.prices[size]), `${product.title} ${size}`).toBeGreaterThan(0);
    }
  });

  test("mineral surcharge is set for every size and grows with the size", () => {
    const values = SIZES.map((size) => toNumber(prices.mineralSurcharge[size]));
    for (const value of values) expect(value).toBeGreaterThan(0);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});

describe("panel patterns", () => {
  test("stone patterns have a title and a photo", () => {
    expect(products.items.length).toBeGreaterThan(0);
    for (const item of products.items) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.imgLight.length).toBeGreaterThan(0);
    }
  });

  test("mineral patterns have a texture that exists (or a Cloudinary URL)", () => {
    expect(products.mineral.length).toBeGreaterThan(0);
    for (const pattern of products.mineral) {
      const ok = pattern.image.startsWith("https://res.cloudinary.com/") || publicFile(pattern.image);
      expect(ok, pattern.image).toBe(true);
    }
  });
});

describe("FAQ", () => {
  test("every question has an answer in both languages", () => {
    for (const lang of ["cs", "en"] as const) {
      for (const item of faqItems(lang)) {
        expect(item.question.trim().length).toBeGreaterThan(0);
        expect(item.answer.trim().length).toBeGreaterThan(0);
        expect(item.mineralAnswer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("an empty mineral answer (as the CMS saves it) falls back to the shared answer", () => {
    const [item] = faqItems("cs", [
      { question: { cs: "Q", en: "Q" }, answer: { cs: "Sdílená", en: "Shared" }, answerMineral: { cs: "  ", en: "" } },
    ]);
    expect(item.mineralAnswer).toBe("Sdílená");
    expect(item.hideInMineral).toBe(false);
  });

  test("a mineral answer replaces the shared one only in the mineral view", () => {
    const [item] = faqItems("en", [
      { question: { cs: "Q", en: "Q" }, answer: { cs: "A", en: "Stone" }, answerMineral: { cs: "M", en: "Mineral" }, hideInMineral: true },
    ]);
    expect(item.answer).toBe("Stone");
    expect(item.mineralAnswer).toBe("Mineral");
    expect(item.hideInMineral).toBe(true);
  });
});

describe("i18n", () => {
  test("cs.json and en.json have the same keys and no empty strings", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    expect(Object.keys(en).sort()).toEqual(Object.keys(cs).sort());
    for (const [lang, strings] of Object.entries({ cs, en }) as [string, Record<string, string>][]) {
      // Feature descriptions are split into parts (text, **bold**, text); word
      // order can leave one part empty, as long as the sentence has text.
      const sentenceHasText = (key: string) => {
        const stem = key.replace(/Desc\d+$/, "Desc");
        return Object.entries(strings).some(([k, v]) => k.startsWith(stem) && v.trim());
      };
      const empty = Object.entries(strings).filter(
        ([key, value]) => !value.trim() && !(/Desc\d+$/.test(key) && sentenceHasText(key)),
      );
      expect(empty.map(([key]) => `${lang}:${key}`)).toEqual([]);
    }
  });

  test("home panel choices show each material description below its button", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const header = await Bun.file("src/components/header/Header.astro").text();

    expect(cs["header.stoneMaterial"]).toBe("Transparentní kamenná dýha 2-3 mm");
    expect(cs["header.mineralMaterial"]).toBe("Transparentní minerální deska 6 mm");
    expect(en["header.stoneMaterial"]).toBe("Transparent stone veneer 2–3 mm");
    expect(en["header.mineralMaterial"]).toBe("Transparent mineral sheet 6 mm");
    expect(header).toMatch(/<Button href=\{getPanelPagePath\("stone", lang\)\}[\s\S]*?<\/Button>\s*<p[^>]*>\s*\{t\("header\.stoneMaterial"\)\}/);
    expect(header).toMatch(/<Button href=\{getPanelPagePath\("mineral", lang\)\}[\s\S]*?<\/Button>\s*<p[^>]*>\s*\{t\("header\.mineralMaterial"\)\}/);
  });

  test("contact confirmation explains the tracked discount code terms", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();

    expect(cs["contact.formSuccess"]).toContain("evidence slevových kódů");
    expect(cs["contact.thanksDesc"]).toContain("5 % pro SLIM a 7 % pro BASIC nebo DELUXE");
    expect(cs["contact.thanksDesc"]).toContain("180 dní od vystavení");
    expect(cs["contact.thanksDesc"]).toContain("individuální nabídky");

    expect(en["contact.formSuccess"]).toContain("discount code register");
    expect(en["contact.thanksDesc"]).toContain("5% for SLIM and 7% for BASIC or DELUXE");
    expect(en["contact.thanksDesc"]).toContain("180 days from issue");
    expect(en["contact.thanksDesc"]).toContain("custom quote");
  });
});
