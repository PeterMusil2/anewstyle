/**
 * Content the site depends on: what the CMS saves must render.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import cms from "../src/data/gallery-cms.json";
import materialOverview from "../src/data/material-overview.json";
import prices from "../src/data/prices.json";
import products from "../src/data/products.json";
import { faqItems } from "../src/lib/faq";
import { getGalleryItems } from "../src/lib/gallery";
import { mineralConstructionMarkers, scaleConstructionMarkerPosition, stoneConstructionMarkers } from "../src/lib/construction-diagram";
import {
  mineralArModelPath,
  PANEL_AR_PLACEMENT,
  panelArModes,
  panelArModelPath,
  panelArViewerStyle,
  samsungInternetArIntent,
  shouldOpenArInSamsungInternet,
  STONE_AR_MODEL_PATH,
  waitForArAvailability,
} from "../src/lib/panel-ar";

const toNumber = (value: string) => Number(value.replace(/\s/g, ""));
const SIZES = ["l", "xl", "xxl", "xxxl"] as const;
const publicFile = (path: string) => existsSync(`public${path}`);

const readGlb = (path: string) => {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trimEnd());
  const binOffset = 20 + jsonLength + 8;
  return { bytes, json, binOffset };
};

const embeddedGlbImages = (path: string) => {
  const { bytes, json, binOffset } = readGlb(path);
  return json.images.map((image: { bufferView: number; mimeType: string }) => {
    const view = json.bufferViews[image.bufferView];
    return {
      mimeType: image.mimeType,
      signature: [...bytes.subarray(binOffset + view.byteOffset, binOffset + view.byteOffset + 8)],
    };
  });
};

describe("hero video", () => {
  test("home keeps the original loop while the stone branch uses the supplied loop", () => {
    const header = readFileSync("src/components/header/Header.astro", "utf8");
    expect(header).toContain('data-home={home ? "true" : "false"}');
    expect(header).toMatch(/isHome\s*\?\s*"\/videos\/hero-mobile\.mp4"/);
    expect(header).toMatch(/isHome\s*\?\s*"\/videos\/hero-1280\.mp4"/);
    expect(header).toContain('"/videos/hero-stone-bomma-v8-mobile.mp4"');
    expect(header).toContain('"/videos/hero-stone-bomma-v8.mp4"');
    expect(publicFile("/videos/hero-mobile.mp4")).toBe(true);
    expect(publicFile("/videos/hero-1280.mp4")).toBe(true);
    expect(publicFile("/videos/hero-stone-bomma-v8.mp4")).toBe(true);
    expect(publicFile("/videos/hero-stone-bomma-v8-mobile.mp4")).toBe(true);
    expect(header).toMatch(/isMineral\s*\?\s*"\/videos\/mineral_before_after_intro_loop_16x9\.mp4"/);
    expect(header).toMatch(/isMineral\s*\?\s*"\/videos\/hero-mineral-mobile\.mp4"/);
  });

  test("mineral mobile hero has the AR CTA and its default mineral texture", () => {
    const header = readFileSync("src/components/header/Header.astro", "utf8");
    expect(header).toContain('id="headerArButton"');
    expect(header).toContain("{t('header.btnAr')}");
    expect(header).toContain('mineralArModelPath(headerMineralTexture)');
    expect(header).toContain('text-[clamp(1.75rem,8vw,3rem)] sm:text-6xl lg:text-7xl');
    expect(publicFile(STONE_AR_MODEL_PATH)).toBe(true);
    expect(publicFile("/images/patterns/mineral-2.png")).toBe(true);
  });

  test("panel AR uses wall anchoring and Android-compatible baked models", async () => {
    const header = await Bun.file("src/components/header/Header.astro").text();
    const productsComponent = await Bun.file("src/components/sections/Products.astro").text();
    const cardComponent = await Bun.file("src/components/product/Card.astro").text();

    expect(PANEL_AR_PLACEMENT).toBe("wall");
    expect(panelArModes()).toBe("webxr quick-look");
    expect(panelArModes()).not.toContain("scene-viewer");
    expect(STONE_AR_MODEL_PATH).toContain("_unlit.glb");
    expect(panelArViewerStyle(false)).toContain("pointer-events:none;z-index:-1");
    expect(panelArViewerStyle(true)).toContain("pointer-events:auto;z-index:2147483647");
    expect(header).toContain('data-ar-placement={PANEL_AR_PLACEMENT}');
    expect(header).toContain('data-ar-modes={panelArModes()}');
    expect(header).toContain('await waitForArAvailability(');
    expect(panelArViewerStyle(false)).toContain('width:100vw;height:100svh');
    expect(header).not.toContain('height:100svh;opacity:0');
    expect(header).toContain('arViewer.style.cssText = panelArViewerStyle(true)');
    expect(header).toContain('status === "not-presenting"');
    expect(header).toContain('void arViewer.activateAR()');
    expect(header).toContain('window.location.href = samsungInternetArIntent(window.location.href)');
    expect(header).toContain('id="arHandoffOverlay"');
    expect(header).toContain('id="arHandoffButton"');
    expect(header).toContain('handoffButton?.addEventListener("click", activatePreparedAR)');
    expect(header).toContain('name="arOrientation" value="0" checked');
    expect(header).toContain('name="arOrientation" value="90"');
    expect(header).toContain('panelArModelPath(portraitModelPath, selectedLandscape())');
    expect(header).toContain('orientationInputs.forEach((input) => input.addEventListener("change", () => { void loadSelectedModel?.(); }))');
    expect(header).not.toContain('id="arRotationControlsTemplate"');
    expect(header).toContain('status === "failed"');
    expect(header).toContain('role="status"');
    expect(productsComponent).toContain('ar-modes={panelArModes()}');
    expect(cardComponent).toContain('ar-modes={panelArModes()}');
    expect(cardComponent).not.toContain("scene-viewer");
    expect(productsComponent).toContain('data-ar-model={pattern.arModel}');
    const sourceModel = readGlb("public/3d/products/Rockfoil_DARKGOLD_3D_vertical.glb");
    const stoneArModel = readGlb(`public${STONE_AR_MODEL_PATH}`);
    expect(stoneArModel.json.extensionsUsed).toContain("KHR_materials_unlit");
    expect(stoneArModel.json.materials.every(
      (material: { extensions?: Record<string, unknown> }) => material.extensions?.KHR_materials_unlit,
    )).toBe(true);
    const sourceImageViews = new Set<number>(
      sourceModel.json.images.map((image: { bufferView: number }) => image.bufferView),
    );
    for (const pattern of products.mineral) {
      const modelPath = `public${mineralArModelPath(pattern.image)}`;
      expect(existsSync(modelPath), pattern.image).toBe(true);
      const images = embeddedGlbImages(modelPath);
      expect(images.length).toBeGreaterThan(0);
      for (const image of images) {
        expect(image.mimeType).toBe("image/png");
        expect(image.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      }
      const bakedModel = readGlb(modelPath);
      expect(bakedModel.json.extensionsUsed).toContain("KHR_materials_unlit");
      expect(bakedModel.json.materials.every(
        (material: { extensions?: Record<string, unknown> }) => material.extensions?.KHR_materials_unlit,
      )).toBe(true);
      sourceModel.json.bufferViews.forEach((sourceView: { byteOffset: number; byteLength: number }, index: number) => {
        if (sourceImageViews.has(index)) return;
        const bakedView = bakedModel.json.bufferViews[index];
        const sourceBytes = sourceModel.bytes.subarray(
          sourceModel.binOffset + sourceView.byteOffset,
          sourceModel.binOffset + sourceView.byteOffset + sourceView.byteLength,
        );
        const bakedBytes = bakedModel.bytes.subarray(
          bakedModel.binOffset + bakedView.byteOffset,
          bakedModel.binOffset + bakedView.byteOffset + bakedView.byteLength,
        );
        expect(bakedBytes.equals(sourceBytes), `${pattern.image} bufferView ${index}`).toBe(true);
      });
    }
  });

  test("AR orientation choices use physically rotated wall models", () => {
    expect(panelArModelPath(STONE_AR_MODEL_PATH, false)).toBe(STONE_AR_MODEL_PATH);
    expect(panelArModelPath(STONE_AR_MODEL_PATH, true)).toContain("_horizontal_unlit.glb");
    expect(() => panelArModelPath("/model.glb", true)).toThrow();

    const portraitPaths = [STONE_AR_MODEL_PATH, ...products.mineral.map((pattern) => mineralArModelPath(pattern.image))];
    for (const portraitPath of portraitPaths) {
      const landscapePath = panelArModelPath(portraitPath, true);
      expect(publicFile(landscapePath), landscapePath).toBe(true);
      const landscapeModel = readGlb(`public${landscapePath}`).json;
      const root = landscapeModel.nodes[landscapeModel.scenes[landscapeModel.scene ?? 0].nodes[0]];
      expect(root.name).toBe("AR landscape orientation");
      expect(root.rotation).toEqual([0, 0, Math.SQRT1_2, Math.SQRT1_2]);
      expect(root.children.length).toBeGreaterThan(0);
    }
  });

  test("affected Android browsers hand AR off to Samsung Internet without a fallback loop", () => {
    const chromeAndroid = "Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36";
    const bingAndroid = `${chromeAndroid} EdgA/140.0`;
    const samsungInternet = `${chromeAndroid} SamsungBrowser/29.0`;

    expect(shouldOpenArInSamsungInternet(chromeAndroid, "?v=test")).toBe(true);
    expect(shouldOpenArInSamsungInternet(bingAndroid, "?v=test")).toBe(true);
    expect(shouldOpenArInSamsungInternet(samsungInternet, "?v=test")).toBe(false);
    expect(shouldOpenArInSamsungInternet(chromeAndroid, "?v=test&ar-direct=1")).toBe(false);
    expect(shouldOpenArInSamsungInternet("Mozilla/5.0 (iPhone)", "")).toBe(false);

    const intent = samsungInternetArIntent("https://example.com/panely/?v=test#products");
    expect(intent).toStartWith("intent://example.com/panely/?v=test&ar-handoff=1#Intent;scheme=https;");
    expect(intent).toContain("package=com.sec.android.app.sbrowser");
    expect(intent).toContain(encodeURIComponent("https://example.com/panely/?v=test&ar-direct=1"));
  });

  test("panel AR waits for model-viewer to finish asynchronous capability detection", async () => {
    let checks = 0;
    let waits = 0;
    const available = await waitForArAvailability(
      () => ++checks === 3,
      async () => { waits += 1; },
      5,
      0,
    );

    expect(available).toBe(true);
    expect(checks).toBe(3);
    expect(waits).toBe(2);
  });

  test("panel AR capability detection stops after the configured timeout", async () => {
    let checks = 0;
    let waits = 0;
    const available = await waitForArAvailability(
      () => { checks += 1; return false; },
      async () => { waits += 1; },
      4,
      0,
    );

    expect(available).toBe(false);
    expect(checks).toBe(4);
    expect(waits).toBe(3);
  });
});

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

describe("home material overview", () => {
  test("uses the requested bilingual mineral copy and the supplied stone-veneer diagram", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    const cs = "Transparentní, litý designový panel s kamennou texturou a vysokým podílem minerálů, který je pevný a skvěle propouští světlo. Jeho tloušťka je 6 mm.";

    expect(materialOverview.mineral.technology.cs).toBe(cs);
    expect(materialOverview.mineral.technology.en).toContain("cast design panel");
    expect(component).toContain("/images/technologies/konstrukce_sviticiho_panelu_kamenna_dyha2.png");
    expect(publicFile("/images/technologies/konstrukce_sviticiho_panelu_kamenna_dyha2.png")).toBe(true);
  });

  test("renders all stone construction numbers as overlay labels matching the mineral diagram", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();

    expect(stoneConstructionMarkers.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(stoneConstructionMarkers.every(({ x, y }) => x > 0 && x < 100 && y > 0 && y < 100)).toBe(true);
    expect(component).toContain("konstrukce_sviticiho_panelu_matna2.png");
    expect(publicFile("/images/technologies/konstrukce_sviticiho_panelu_matna2.png")).toBe(true);
    expect(component).toContain("stoneConstructionMarkers");
    for (const [index, marker] of stoneConstructionMarkers.slice(0, 4).entries()) {
      const mineralMarker = mineralConstructionMarkers[index];
      expect(marker.x).toBeCloseTo(scaleConstructionMarkerPosition(mineralMarker.x, 1.18));
      expect(marker.y).toBeCloseTo(scaleConstructionMarkerPosition(mineralMarker.y, 1.18));
    }
  });

  test("enlarges the mineral construction diagram and labels all six layers", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();

    expect(mineralConstructionMarkers.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(mineralConstructionMarkers.every(({ x, y }) => x > 0 && x < 100 && y > 0 && y < 100)).toBe(true);
    expect(component).toContain("scale: 1.18");
    expect(component).toContain("mineralConstructionMarkers");
    expect(component).toContain("/images/technologies/konstrukce_sviticiho_mineralniho_panelu.png");
    expect(publicFile("/images/technologies/konstrukce_sviticiho_mineralniho_panelu.png")).toBe(true);
  });

  test("keeps mineral diagram labels the same size while aligning them to the enlarged image", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    const alignedMineralPositions = mineralConstructionMarkers.map(({ x, y }) => [
      scaleConstructionMarkerPosition(x, 1.18),
      scaleConstructionMarkerPosition(y, 1.18),
    ]);

    expect(alignedMineralPositions[0][0]).toBeCloseTo(97);
    expect(alignedMineralPositions.map(([, y]) => y)).toEqual([
      expect.closeTo(4),
      expect.closeTo(30),
      expect.closeTo(47),
      expect.closeTo(59),
      expect.closeTo(94),
      expect.closeTo(83),
    ]);
    expect(scaleConstructionMarkerPosition(50, 1.18)).toBe(50);
    expect(component).toContain("pointer-events-none absolute inset-0");
    expect(component).toContain("w-[calc(100%+1.5rem)] max-w-[24.5rem]");
    expect(component).toContain("w-[calc(100%-1.5rem)]");
    expect(component).toContain("scaleConstructionMarkerPosition(marker.x, item.scale)");
    expect(component).toContain("grid size-6");
  });

  test("covers the baked 1–4 badges with the shared overlay labels", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();

    expect(component).toContain("pointer-events-none absolute inset-0");
    expect(component).toContain("stoneConstructionMarkers");
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
    expect(header).toMatch(/<Button href=\{getPanelPagePath\("stone", lang\)\} variant="outline"/);
    expect(header).toMatch(/<Button href=\{getPanelPagePath\("mineral", lang\)\} variant="outline"/);
    expect(header.match(/class="home-category-button w-full min-h-15 sm:min-h-16"/g)).toHaveLength(2);
    expect(header.match(/class="home-category-label"/g)).toHaveLength(2);
    expect(header).toContain('"text-[clamp(2.25rem,11.5vw,4.5rem)] sm:text-7xl lg:text-[7.5rem]"');
    expect(header).toContain('"hero-title__label--home": home');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".home-category-label,");
    expect(effects).toContain(".hero-title__label {");
    expect(effects).toContain(".hero-title__label--home {");
    expect(effects).toContain("width: max-content");
    expect(effects).toContain("white-space: nowrap");
    expect(effects).toContain("inset-inline: 18%");
    expect(effects).toContain("rgb(0 0 0 / 0.58) 0%");
    expect(effects).toContain("transparent 74%");
    expect(effects).toContain(".home-category-button:is(:hover, :focus-visible) .home-category-label::before");
    expect(effects).toContain("transition: opacity 180ms var(--ease-out-soft)");
    expect(effects).not.toContain(".home-category-button::before");
  });

  test("panel hero places a gold home icon under video controls and matches CTA sizes", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const header = await Bun.file("src/components/header/Header.astro").text();
    const nav = await Bun.file("src/components/nav/Nav.astro").text();

    expect(cs["nav.home"]).toBe("Domů");
    expect(en["nav.home"]).toBe("Home");
    expect(header).toContain('{!home && panelCategory && (');
    expect(header).toContain('<Icon name="home" class="size-5" />');
    expect(header).toContain('aria-label={t("nav.home")}');
    expect(header).toContain('class="hero-home-link absolute z-10 grid size-11');
    expect(header).toContain('id="headerMoreButton" class="w-64"');
    expect(header).toContain('<div class="w-64 lg:hidden!">');
    expect(header).toMatch(/<Button\s+variant="outline"\s+id="headerArButton"[\s\S]*?class="w-full/);
    expect(nav).not.toContain('<Icon name="home"');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".hero-home-link {");
    expect(effects).toContain("inset-block-start: calc(var(--nav-height) + 1.5rem + 3.25rem)");
    expect(nav).toContain('const mobileLinks = links');
  });

  test("home header keeps FAQ and day-night sections out of the navigation", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    expect(nav).not.toContain('text: t("nav.dayNight")');
    expect(nav).not.toContain('text: t("nav.faq")');
  });

  test("comparison table shows concise linked thickness values in both languages", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const comparison = await Bun.file("src/components/sections/HomeEquipmentComparison.astro").text();

    expect([cs["price.feature1Short"], cs["price.feature1MineralShort"], cs["price.feature2Short"], cs["price.feature2MineralShort"]]).toEqual(["16 mm", "20 mm", "34 mm", "38 mm"]);
    expect([en["price.feature1Short"], en["price.feature1MineralShort"], en["price.feature2Short"], en["price.feature2MineralShort"]]).toEqual(["16 mm", "20 mm", "34 mm", "38 mm"]);
    expect(comparison).toContain("thicknessValueLabel(key, \"stone\")");
    expect(comparison).toContain("thicknessValueLabel(key, \"mineral\")");
    expect(comparison).toContain("aria-label={featureLabel(key, \"stone\")}");
    expect(comparison).toContain("aria-label={featureLabel(key, \"mineral\")}");
  });

  test("contact confirmation explains the tracked discount code terms", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const contact = await Bun.file("src/components/sections/Contact.astro").text();

    expect(cs["contact.formSuccess"]).toContain("zaznamenali do evidence");
    expect(cs["contact.codeLabel"]).toContain("slevový kód");
    expect(cs["contact.codeEmailSent"]).toContain("odeslali");
    expect(cs["contact.thanksDesc"]).toContain("5 % pro SLIM a 7 % pro BASIC nebo DELUXE");
    expect(cs["contact.thanksDesc"]).toContain("180 dní od vystavení");
    expect(cs["contact.thanksDesc"]).toContain("individuální nabídky");

    expect(en["contact.formSuccess"]).toContain("recorded your discount code");
    expect(en["contact.codeLabel"]).toContain("discount code");
    expect(en["contact.codeEmailSent"]).toContain("sent the code");
    expect(en["contact.thanksDesc"]).toContain("5% for SLIM and 7% for BASIC or DELUXE");
    expect(en["contact.thanksDesc"]).toContain("180 days from issue");
    expect(en["contact.thanksDesc"]).toContain("custom quote");
    expect(contact).toContain('action="/api/contact"');
    expect(contact).toContain('id="contact-discount-code"');
    expect(contact).not.toContain("api.web3forms.com");
  });
});
