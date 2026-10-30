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
import {
  isAppleQuickLookDevice,
  mineralArModelPath,
  PANEL_AR_PLACEMENT,
  panelArModes,
  panelArModelPath,
  panelArPlacementForDevice,
  panelArQuickLookModelPath,
  panelArViewerStyle,
  safariArUrl,
  samsungInternetArIntent,
  shouldOpenArInSafari,
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
    expect(header).toContain('window.location.href = safariArUrl(window.location.href)');
    expect(header).toContain('window.location.href = samsungInternetArIntent(window.location.href)');
    expect(header).toContain('id="arHandoffOverlay"');
    expect(header).toContain('id="arHandoffButton"');
    expect(header).toContain('data-safari={t("header.arHandoffSafariHint")}');
    expect(header).toContain('data-samsung={t("header.arHandoffSamsungHint")}');
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
    expect(intent).toStartWith("intent://example.com/panely/?v=test&ar-handoff=1&ar-browser=samsung#Intent;scheme=https;");
    expect(intent).toContain("package=com.sec.android.app.sbrowser");
    expect(intent).toContain(encodeURIComponent("https://example.com/panely/?v=test&ar-direct=1"));
  });

  test("Chrome and the Google app on iOS hand AR off to Safari without looping", () => {
    const chromeIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1";
    const googleAppIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 GSA/384.0 Mobile/15E148 Safari/604.1";
    const safariIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1";

    expect(shouldOpenArInSafari(chromeIos, "?v=test")).toBe(true);
    expect(shouldOpenArInSafari(googleAppIos, "?v=test")).toBe(true);
    expect(shouldOpenArInSafari(safariIos, "?v=test")).toBe(false);
    expect(shouldOpenArInSafari(chromeIos, "?v=test&ar-browser=safari")).toBe(false);
    expect(shouldOpenArInSafari(chromeIos, "?v=test&ar-direct=1")).toBe(false);

    expect(safariArUrl("https://example.com/panely/?v=test#products")).toBe(
      "x-safari-https://example.com/panely/?v=test&ar-handoff=1&ar-browser=safari",
    );
  });

  test("Quick Look uses a reliable floor anchor while Android keeps wall placement", async () => {
    const header = await Bun.file("src/components/header/Header.astro").text();
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
    const ipadDesktopMode = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    const android = "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36";

    expect(panelArPlacementForDevice(iphone)).toBe("floor");
    expect(panelArPlacementForDevice(ipadDesktopMode, 5)).toBe("floor");
    expect(panelArPlacementForDevice(ipadDesktopMode, 0)).toBe("wall");
    expect(panelArPlacementForDevice(android, 5)).toBe("wall");
    expect(isAppleQuickLookDevice(iphone)).toBe(true);
    expect(isAppleQuickLookDevice(ipadDesktopMode, 5)).toBe(true);
    expect(isAppleQuickLookDevice(android, 5)).toBe(false);
    expect(header).toContain("panelArPlacementForDevice(window.navigator.userAgent, window.navigator.maxTouchPoints)");
  });

  test("Safari Quick Look receives prebuilt USDZ models for both panel orientations", async () => {
    const header = await Bun.file("src/components/header/Header.astro").text();
    const headers = await Bun.file("public/_headers").text();
    const modelPaths = [
      panelArQuickLookModelPath(STONE_AR_MODEL_PATH, false),
      panelArQuickLookModelPath(STONE_AR_MODEL_PATH, true),
      panelArQuickLookModelPath(mineralArModelPath("/images/patterns/mineral-2.png"), false),
      panelArQuickLookModelPath(mineralArModelPath("/images/patterns/mineral-2.png"), true),
    ];

    expect(modelPaths).toEqual([
      "/3d/products/Rockfoil_DARKGOLD_AR_vertical_quicklook.usdz",
      "/3d/products/Rockfoil_DARKGOLD_AR_horizontal_quicklook.usdz",
      "/3d/products/Mineral_02_3D_vertical_quicklook.usdz",
      "/3d/products/Mineral_02_3D_horizontal_quicklook.usdz",
    ]);
    for (const modelPath of modelPaths) {
      const bytes = readFileSync(`public${modelPath}`);
      expect(bytes.byteLength).toBeGreaterThan(100_000);
      expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
    }
    expect(header).toContain('viewer.setAttribute("ios-src", panelArQuickLookModelPath');
    expect(headers).toContain("Content-Type: model/vnd.usdz+zip");
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
  test("labels the product patterns section as stone patterns", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const component = await Bun.file("src/components/sections/Products.astro").text();

    expect(cs["products.heading"]).toBe("Vzory kamene");
    expect(en["products.heading"]).toBe("Stone patterns");
    expect(cs["products.headingMineral"]).toBe("Vzory minerálních panelů");
    expect(en["products.headingMineral"]).toBe("Mineral panel patterns");
    expect(cs["products.title"]).toBe("Povrchy");
    expect(en["products.title"]).toBe("Surfaces");
    expect(component).toContain('t(panelCategory === "mineral" ? "products.headingMineral" : "products.heading")');
  });

  test("stone pattern hint explains click-to-preview and AR placement", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();

    expect(cs["products.stoneFanHint"]).toBe("Kliknutím na vybraný vzor kamene otevřete jeho 3D náhled a na kompatibilním telefonu také jeho umístění do Vašeho interiéru.");
    expect(en["products.stoneFanHint"]).toContain("place it in your interior using AR");
  });

  test("stone pattern note explains that individual stock pieces cannot yet be shown in AR", () => {
    expect(products.notes.stone.cs).toContain("jednotlivé aktuálně skladové kusy zatím v AR zobrazit neumíme");
    expect(products.notes.stone.en).toContain("for now, we cannot show every individual in-stock piece in AR");
  });

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
  test("uses one bilingual composition image for the stone veneer and mineral panel", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    const cs = "Transparentní, litý designový panel s vysokým podílem minerálů a hladkým povrchem, o tloušťce 6 mm.";
    const image = "/images/technologies/konstrukce_sviticiho_panelu_kamenna_dyha-mineral.png";

    expect(materialOverview.mineral.technology.cs).toBe(cs);
    expect(materialOverview.mineral.technology.en).toContain("cast design panel");
    expect(component.match(/<Picture src="\/images\/technologies\/konstrukce_sviticiho_panelu_kamenna_dyha-mineral\.png"/g)).toHaveLength(1);
    expect(component).not.toContain("/images/technologies/konstrukce_sviticiho_panelu_kamenna_dyha2.png");
    expect(component).not.toContain("/images/technologies/mineral-perspective.png");
    expect(publicFile(image)).toBe(true);
    expect(materialOverview.materialComposition.imageAlt.cs).toContain("kamenné dýhy");
  });

  test("renders one shared construction image and preserves the two alternative front layers and layers 2–6", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    const image = "/images/technologies/konstrukce_sviticiho_panelu.png";

    expect(component.match(/<Picture src="\/images\/technologies\/konstrukce_sviticiho_panelu\.png"/g)).toHaveLength(1);
    expect(component).not.toContain("konstrukce_sviticiho_panelu_matna2.png");
    expect(component).not.toContain("konstrukce_sviticiho_mineralniho_panelu.png");
    expect(publicFile(image)).toBe(true);
    expect(materialOverview.sharedConstruction.stoneLayer.cs).toBe("Transparentní kamenná dýha");
    expect(materialOverview.sharedConstruction.mineralLayer.cs).toBe("Transparentní minerální panel");
    expect(materialOverview.sharedConstruction.description.cs).toBe("Svítící kamenné panely AnewStyle jsou kombinací zajímavých technologií. Spojení tenké vrstvy přírodního kamene nebo transparentní, minerální desky s bočním nasvícením světlovodivé desky s rovnoměrným celoplošným rozptylem světla. Tento způsob nasvícení umožňuje v případě potřeby snadnou výměnu zdroje světla.");
    expect(component).toContain('{ number: "1A", label: localized(sharedConstruction.stoneLayer');
    expect(component).toContain('{ number: "1B", label: localized(sharedConstruction.mineralLayer');
    for (const number of ["2", "3", "4", "5", "6"]) expect(component).toContain(`number: "${number}"`);
    expect(materialOverview.sharedConstruction.imageHeading.cs).toBe("Konstrukce svítícího panelu Anew Style");
  });

  test("overlays the four composition callouts in the supplied diagram positions", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    expect(component).toContain("compositionMarkers.map((marker)");
    for (const marker of [
      '{ number: "1", x: 37.3, y: 4.5 }',
      '{ number: "2", x: 41.5, y: 6.7 }',
      '{ number: "3", x: 45.2, y: 12.5 }',
      '{ number: "4", x: 47.5, y: 22.8 }',
    ]) expect(component).toContain(marker);
  });
});

describe("panel landing material cards", () => {
  test("shows category-specific consumption and luminance cards on both panel pages", async () => {
    const panelLanding = await Bun.file("src/components/pages/PanelLanding.astro").text();
    const materialOverview = await Bun.file("src/data/material-overview.json").json();
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();

    expect(panelLanding).toContain("{material.consumption}");
    expect(panelLanding).toContain("{material.luminance}");
    expect(materialOverview.stone.consumption.cs).toBe("Od 74W u velikosti L.");
    expect(materialOverview.stone.luminance.cs).toBe("Jas (luminance) od 200 cd/m2, podle kresby kamene");
    expect(materialOverview.mineral.consumption.cs).toBe("Od 35W u velikosti L.");
    expect(materialOverview.mineral.luminance.cs).toBe("Jas (luminance) od 500 cd/m2, podle propustnosti vzoru minerálního panelu");
    expect(cs["panelPage.materialConsumption"]).toBe("Spotřeba");
    expect(cs["panelPage.materialLuminance"]).toBe("Svítivost");
    expect(en["panelPage.materialConsumption"]).toBe("Power consumption");
    expect(en["panelPage.materialLuminance"]).toBe("Luminance");
  });
});

describe("price navigation", () => {
  test("offers both category price lists from home and panel navigation", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const priceNav = await Bun.file("src/components/nav/PriceNavItem.astro").text();
    const normalizedNav = nav.replace(/\r\n/g, "\n");

    expect(nav).toContain("<PriceNavItem lang={lang} />");
    expect(nav).toContain('<PriceNavItem lang={lang} variant="panel" />');
    expect(normalizedNav.match(/\{homeLinks\.map\(\(link\) => <NavItem \{\.\.\.link\}(?: variant="panel")? \/>\)\}/g)).toHaveLength(2);
    expect(normalizedNav).not.toContain("comparisonLink");
    expect(normalizedNav).not.toContain('t("nav.products")');
    expect(nav).toContain('<InfoNavItem lang={lang} />');
    expect(nav).toContain('<InfoNavItem lang={lang} variant="panel" />');
    expect(normalizedNav).not.toContain('href: `${getPanelPagePath(panelCategory, lang)}#price-list`');
    expect(priceNav).toContain('getPanelPagePath("stone", lang)}#price-list');
    expect(priceNav).toContain('getPanelPagePath("mineral", lang)}#price-list');
    expect(priceNav).toContain('t("nav.priceStone")');
    expect(priceNav).toContain('t("nav.priceMineral")');
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    expect(cs["nav.priceStone"]).toBe("Svítící kamenné panely");
    expect(cs["nav.priceMineral"]).toBe("Svítící minerální panely");
    expect(en["nav.priceStone"]).toBe("Illuminated stone panels");
    expect(en["nav.priceMineral"]).toBe("Illuminated mineral panels");
    expect(priceNav).toContain("data-nav-link");
    expect(priceNav).toContain('"price-nav-item__trigger flex cursor-pointer list-none items-center justify-between gap-2 font-bold tracking-caps text-fg-soft uppercase');
    expect(priceNav).toContain('trigger.setAttribute("aria-current", "location")');
    expect(priceNav).toContain('.price-nav-item__trigger[data-active="true"]');
    expect(priceNav).toContain("data-price-nav-option");
    expect(priceNav).toContain('option.setAttribute("aria-current", "location")');
    expect(priceNav).toContain('.price-nav-item__menu a[data-active="true"]');
    expect(priceNav).toContain('.price-nav-item__menu a[data-active="true"]:is(:hover, :focus-visible)');
    expect(priceNav).toContain('.price-nav-item__trigger[data-active="true"]:is(:hover, :focus-visible)');
    expect(priceNav).toContain('hover:text-gold-light');
    expect(priceNav).toContain('variant === "panel" && "min-h-14 border-b border-line text-[0.8125rem] tracking-[0.12em]"');
    expect(priceNav).toContain('variant === "panel" && "min-h-12 border-b border-line px-3 text-base last:border-b-0"');
  });

  test("keeps the active navigation destination gold while retaining hover styling", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const navItem = await Bun.file("src/components/nav/NavItem.astro").text();

    expect(nav).toContain('document.querySelectorAll<HTMLAnchorElement>(".site-nav [data-nav-link]")');
    expect(nav).toContain('link.setAttribute("aria-current", targetUrl.hash ? "location" : "page")');
    expect(nav).toContain('window.addEventListener("scroll", updateActiveNavLinks, { passive: true })');
    expect(navItem).toContain('a[data-active="true"]');
    expect(navItem).toContain('a[data-active="true"]:is(:hover, :focus-visible)');
    expect(navItem).toContain("hover:text-gold-light");
  });

  test("switches to the desktop navigation at the preview's desktop width", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();

    expect(nav).toContain('class="hidden items-center gap-3 min-[1200px]:flex 2xl:gap-8"');
    expect(nav).toContain('hover:text-gold min-[1200px]:hidden"');
    expect(nav).toContain('text-fg min-[1200px]:hidden"');
  });
});

describe("price list category labels", () => {
  test("shows the specific panel category in each branch instead of the generic label", async () => {
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();

    expect(priceList).toContain('{panelCategory ? panelCategory === "mineral" ? t("price.categoryMineral") : t("price.categoryStone") : t("price.eyebrow")}');
  });

  test("mineral custom-size offer uses the concise custom production description", async () => {
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();

    expect(priceList).toContain('{panelCategory === "mineral" ? t("price.customDescMineral") : t("price.customDesc")}');
    expect(cs["price.customDescMineral"]).toBe("Nabízíme zákaznickou výrobu na míru.");
    expect(en["price.customDescMineral"]).toBe("We offer custom-made production.");
  });
});

describe("homepage navigation", () => {
  test("keeps core links visible and groups supporting pages under Information", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const homeLinks = nav.slice(nav.indexOf("const homeLinks = ["), nav.indexOf("const contactLink ="));
    const infoNav = await Bun.file("src/components/nav/InfoNavItem.astro").text();

    expect(homeLinks).not.toContain('href: "#about"');
    expect(homeLinks).not.toContain('t("nav.faq")');
    expect(homeLinks).toContain('t("nav.technologies")');
    expect(homeLinks).toContain('t("nav.features")');
    expect(homeLinks).toContain('href: `${basePath}/#technologies`');
    expect(homeLinks).toContain('href: `${basePath}/#features`');
    expect(nav).toContain('text: t("nav.contact")');
    expect(infoNav).toContain('t("nav.gallery")');
    expect(infoNav).toContain('t("nav.faq")');
    expect(infoNav).toContain('t("nav.manual")');
    expect(infoNav).toContain('href: `${basePath}/#faq`');
    expect(infoNav).toContain('getPanelPagePath("stone", lang)}#products`');
    expect(infoNav).toContain('getPanelPagePath("mineral", lang)}#products`');
    expect(infoNav).toContain('t("nav.surfaceStone")');
    expect(infoNav).toContain('t("nav.surfaceMineral")');
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    expect(cs["nav.products"]).toBe("Povrchy");
    expect(cs["nav.surfaceStone"]).toBe("Kamenné");
    expect(cs["nav.surfaceMineral"]).toBe("Minerální");
    expect(en["nav.products"]).toBe("Surfaces");
    expect(en["nav.surfaceStone"]).toBe("Stone");
    expect(en["nav.surfaceMineral"]).toBe("Mineral");
  });

  test("matches mobile dropdown headings to nav typography and auto-closes desktop menus", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const panelSwitch = await Bun.file("src/components/nav/PanelNavSwitch.astro").text();
    const infoNav = await Bun.file("src/components/nav/InfoNavItem.astro").text();
    const priceNav = await Bun.file("src/components/nav/PriceNavItem.astro").text();

    for (const component of [panelSwitch, infoNav]) {
      expect(component).toContain("font-family: var(--font-sans);");
      expect(component).toContain("font-size: 1rem;");
      expect(component).toContain("font-weight: 700;");
      expect(component).toContain("letter-spacing: var(--tracking-caps);");
    }
    expect(nav).toContain('(min-width: 1200px) and (hover: hover) and (pointer: fine)');
    expect(nav).toContain('menu?.querySelectorAll<HTMLDetailsElement>("details")');
    expect(nav).toContain('const mobileHover = window.matchMedia("(max-width: 1199px) and (hover: hover) and (pointer: fine)")');
    expect(nav).toContain('const closeMobileDropdownTree = (root: HTMLDetailsElement)');
    expect(nav).toContain('details.addEventListener("pointerleave", (event) =>');
    expect(nav).toContain('if (mobileHover.matches && event.pointerType === "mouse") closeMobileDropdownTree(details);');
    expect(nav).toContain('menu?.addEventListener("click"');
    expect(nav).toContain('target.closest("summary")');
    expect(nav).toContain('clickedDropdown.querySelector(":scope > summary")');
    expect(nav).toContain('details.contains(clickedDropdown)');
    expect(nav).toContain('clickedDropdown.contains(details)');
    expect(nav).toContain('target.closest("[data-nav-link]")');
    expect(nav).toContain('menu?.addEventListener("toggle"');
    expect(nav).toContain('menu.matches(":popover-open")');
    expect(nav).toContain('details.addEventListener("pointerenter"');
    expect(nav).toContain('details.addEventListener("pointerleave"');
    expect(nav).toContain('window.addEventListener("scroll"');
    expect(nav).toContain('details.addEventListener("focusout"');
    expect(nav).toContain('event.key === "Escape"');
    expect(priceNav).not.toContain('"absolute inset-inline-start-0 top-full z-50 mt-2');
  });

  test("uses one desktop and mobile menu on home and both panel pages", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const desktopStart = nav.indexOf('<ul class="hidden items-center gap-3 min-[1200px]:flex 2xl:gap-8">');
    const desktop = nav.slice(desktopStart, nav.indexOf("</ul>", desktopStart));
    const mobileStart = nav.indexOf('<ul class="flex flex-col">');
    const mobile = nav.slice(mobileStart, nav.indexOf("</ul>", mobileStart));

    for (const menu of [desktop, mobile]) {
      expect(menu).toContain("<PanelNavSwitch");
      expect(menu).toContain("{homeLinks.map((link) => <NavItem");
      expect(menu).toContain("<PriceNavItem");
      expect(menu).toContain("<NavItem {...contactLink}");
      expect(menu).toContain("<InfoNavItem");
      expect(menu).not.toContain("comparisonLink");
      expect(menu).not.toContain('t("nav.products")');
    }
    expect(nav).not.toContain("const links = panelCategory");
  });
});

describe("home lighting comparison", () => {
  test("keeps the shared state control directly above both panels without the redundant hint", async () => {
    const component = await Bun.file("src/components/sections/HomeShowcase.astro").text();
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const controlsAt = component.indexOf('name="home-showcase-state"');
    const panelsAt = component.indexOf("class=\"grid grid-cols-2 items-stretch");

    expect(controlsAt).toBeGreaterThan(-1);
    expect(panelsAt).toBeGreaterThan(controlsAt);
    expect(component).toContain("home-showcase-comparison mx-auto flex w-full max-w-6xl flex-col gap-4");
    expect(component).not.toContain("home.showcaseStateHint");
    expect(cs["home.showcaseStateHint"]).toBeUndefined();
    expect(en["home.showcaseStateHint"]).toBeUndefined();
  });

  test("places each panel link and material caption below its image", async () => {
    const component = await Bun.file("src/components/sections/HomeShowcase.astro").text();
    const mobileButtonStyles = "whitespace-normal! leading-tight max-sm:text-[0.625rem]!";
    const stoneButtonAt = component.indexOf('<Button href={stoneHref}');
    const mineralButtonAt = component.indexOf('<Button href={mineralHref}');
    const controlsAt = component.indexOf('name="home-showcase-state"');
    const panelsAt = component.indexOf("class=\"grid grid-cols-2 items-stretch");

    expect(stoneButtonAt).toBeGreaterThan(-1);
    expect(mineralButtonAt).toBeGreaterThan(stoneButtonAt);
    expect(controlsAt).toBeLessThan(panelsAt);
    expect(panelsAt).toBeLessThan(stoneButtonAt);
    expect(stoneButtonAt).toBeLessThan(mineralButtonAt);
    expect(component.slice(stoneButtonAt, mineralButtonAt)).toContain(mobileButtonStyles);
    expect(component.slice(stoneButtonAt, mineralButtonAt)).toContain("home.openStone");
    expect(component.slice(stoneButtonAt, mineralButtonAt)).toContain("header.stoneMaterial");
    expect(component.slice(mineralButtonAt)).toContain("home.openMineral");
    expect(component.slice(mineralButtonAt)).toContain("header.mineralMaterial");
    expect(component).toMatch(/margin-block-end: 62%;\s+overflow: visible;/);
    expect(component).toMatch(/width: 118\.1%;\s+height: 59\.04%;/);
    expect(component).toMatch(/top: 62%;\s+width: 118\.1%;/);
    expect(component).toMatch(/top: 126%;\s+width: 59\.04%;/);
  });

  test("keeps showcase panels close in size and preserves the reflection gap", async () => {
    const component = await Bun.file("src/components/sections/HomeShowcase.astro").text();

    expect(component).toMatch(/width: 100\.65%;\s+height: 51\.55%;/);
    expect(component).toMatch(/width: 53\.7%;\s+height: 104\.85%;/);
    expect(component).toMatch(/width: 118\.1%;\s+height: 59\.04%;/);
    expect(component).toMatch(/width: 61\.5%;\s+height: 123%;/);
    expect(component).toContain("transform: translate(-50%, -50%);");
    expect(component).toMatch(/\.showcase__stone-states \[data-state\]\) \{\s+top: 53%;/);
    expect(component).toContain("top: 110.5%;");
    expect(component).toContain("top: 108.3%;");
    expect(component).toContain("top: 128.5%;");
    expect(component).toContain("top: 126%;");
    expect(component).toContain("border border-transparent bg-transparent");
    expect(component).toMatch(/\.showcase__mineral-reflection\) \{\s+background: transparent;\s+border: 0;/);
    expect(component).not.toContain("bg-ink ring-1 ring-line");
  });
});

describe("home section rhythm", () => {
  test("reduces top spacing for anchored sections on home and both panel routes", async () => {
    const styles = await Bun.file("src/styles/global.css").text();

    expect(styles).toContain("main > section[id]:not(#panel-material):not(.pricing):target,");
    expect(styles).toContain("main > section:has(#about:target)");
    expect(styles).toContain("padding-block-start: 1rem;");
    expect(styles).toContain("main > section#panel-material:target > .container-page");
    expect(styles).toContain("main > section.pricing:target > .price-catalog > .container-page:first-child");
    expect(styles).toContain("main > section#gallery,");
    expect(styles).toContain("main > section#manual,");
    expect(styles).toContain("main > section.faq-standalone {");
  });

  test("keeps the same tight top spacing on all requested shared sections", async () => {
    const styles = await Bun.file("src/styles/global.css").text();

    for (const selector of [
      "main > section:has(#about)",
      "main > section#technologies",
      "main > section#features",
      "main > section#day-night",
      "main > section#faq",
      "main > section#contact",
      "main > section#products",
      "main > section#equipment-comparison",
    ]) {
      expect(styles).toContain(selector);
    }
  });

  test("sizes the desktop showcase to keep panels, reflections, and controls in view", async () => {
    const component = await Bun.file("src/components/sections/Showcase.astro").text();

    expect(component).toContain("lg:py-[clamp(2.5rem,7svh,5rem)]");
    expect(component).toContain("lg:aspect-auto lg:h-[min(55svh,38rem)]");
  });

  test("uses slightly tighter spacing and alternating brand surfaces on the shared home page", async () => {
    const files = [
      ["src/components/sections/HomeShowcase.astro", "home-section-y home-section-divider relative isolate overflow-hidden bg-ink"],
      ["src/components/sections/MaterialOverview.astro", "home-section-y home-section-divider bg-ink-800"],
      ["src/components/sections/Features.astro", "home-section-y home-section-divider bg-ink"],
      ["src/components/sections/HomeEquipmentComparison.astro", "home-section-y home-section-divider bg-ink-800"],
      ["src/components/sections/HomeDayNight.astro", "home-section-y home-section-divider bg-ink"],
      ["src/components/sections/Contact.astro", "home-section-y home-section-divider bg-ink-800"],
    ] as const;

    for (const [path, classes] of files) {
      expect(await Bun.file(path).text()).toContain(classes);
    }

    const styles = await Bun.file("src/styles/global.css").text();
    expect(styles).toContain("@utility home-section-y {");
    expect(styles).toContain("padding-block: 4.25rem;");
    expect(styles).toContain("padding-block: 6.5rem;");
    expect(styles).toContain(".home-section-divider::before {");

    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const chapterKeys = [
      "home.chapterLight",
      "home.chapterTechnology",
      "home.chapterFeatures",
      "home.chapterComparison",
      "home.chapterDayNight",
      "home.chapterContact",
    ];
    for (const key of chapterKeys) {
      expect(cs[key]).not.toMatch(/^\d+\s*·/);
      expect(en[key]).not.toMatch(/^\d+\s*·/);
    }
    expect(cs["home.chapterLight"]).toBe("Rozsviť mě");
    expect(en["home.chapterLight"]).toBe("Light it up");
    expect(await Bun.file("src/components/sections/HomeEquipmentComparison.astro").text()).toContain("home-section-divider bg-ink-800");
    expect(await Bun.file("src/components/sections/Contact.astro").text()).toContain("sm:bg-ink-850");
  });
});

describe("panel landing visual rhythm", () => {
  test("stone and mineral branches share the alternating surface and divider treatment", async () => {
    const landing = await Bun.file("src/components/pages/PanelLanding.astro").text();
    const products = await Bun.file("src/components/sections/Products.astro").text();
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();

    expect(landing).toContain('id="panel-material" aria-labelledby="panel-material-title" class="home-section-divider bg-ink"');
    expect(products).toContain('class="home-section-y home-section-divider overflow-x-clip bg-ink-800"');
    expect(priceList).toContain('class="pricing home-section-divider bg-ink"');
  });

  test("centers the material overview and all six property cards in both panel branches", async () => {
    const landing = await Bun.file("src/components/pages/PanelLanding.astro").text();

    expect(landing).toContain('class="container-page flex flex-col items-center gap-7 py-8 sm:py-10"');
    expect(landing).toContain('class="flex max-w-3xl flex-col items-center gap-3 text-center"');
    expect(landing).toContain('class="grid w-full max-w-5xl gap-3 sm:grid-cols-2"');
    expect(landing.match(/<dt class="text-center /g)).toHaveLength(6);
    expect(landing.match(/<dd class="mt-2 text-center /g)).toHaveLength(6);
  });
});

describe("feature disclosures", () => {
  test("uses native expandable cards on the shared home page and preserves anchor targets", async () => {
    const component = await Bun.file("src/components/sections/Features.astro").text();

    expect(component).toContain("features.map((feature)");
    expect(component).toContain('<details class="group/feature">');
    expect(component).toContain('<h3 class="min-w-0 flex-1 text-sm leading-snug font-black tracking-[0.06em] uppercase">');
    expect(component).toContain('items-center gap-3 rounded-sm text-fg');
    expect(component).not.toContain("<details open=");
    expect(component).not.toContain("feature-color-palette");
    const palette = await Bun.file("src/components/palette/Palette.astro").text();
    expect(palette).toContain('<ul class="flex h-12 items-center gap-3"');
    expect(component).toContain("feature-disclosure-indicator");
    expect(component).toContain('if (!feature?.matches("li[id]")) return;');
    expect(component).toContain("border-line-strong bg-ink-900");
    expect(component).toContain("border-gold/70 bg-gold/10");
    expect(component).toContain("openAnchoredFeature();");
    expect(component).toContain("window.addEventListener(\"hashchange\", openAnchoredFeature)");
  });
});

describe("FAQ", () => {
  test("uses a centered heading and a compact, responsive native accordion grid", async () => {
    const faq = await Bun.file("src/components/sections/Faq.astro").text();

    expect(faq).toContain('layout="center" eyebrow={t("faq.title")}');
    expect(faq).toContain("grid items-start gap-3 md:grid-cols-2 md:gap-4 lg:gap-5");
    expect(faq).toContain('name="faq"');
    expect(faq).not.toContain("open={index === 0}");
    expect(faq).toContain('standalone ? "section-y bg-ink faq-standalone" : "home-section-y home-section-divider bg-ink"');
  });

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

  test("panel page switch shows all three destinations and marks the current page", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const header = await Bun.file("src/components/header/Header.astro").text();
    const switcher = await Bun.file("src/components/ui/PanelCategorySwitch.astro").text();

    expect(cs["nav.allPanels"]).toBe("Vše o panelech Anew Style");
    expect(en["nav.allPanels"]).toBe("All about Anew Style panels");
    expect(header).toContain('<PanelCategorySwitch lang={lang} activeCategory={panelCategory} />');
    expect(switcher).toContain('getPanelPagePath("stone", lang)');
    expect(switcher).toContain('getPanelPagePath("mineral", lang)');
    expect(switcher).toContain('label: t("nav.allPanels")');
    expect(switcher).toContain('active: !activeCategory');
    expect(switcher).toContain('"panel-switch__label",');
    expect(switcher).toContain("white-space: normal;");
    expect(switcher).toContain("display: block;");
    expect(switcher).toContain("text-wrap: balance;");
    expect(switcher).toContain('font-size: clamp(0.9rem, 1.1vw, 1rem)');
    expect(switcher).toContain('const learnMoreHref = "#panel-material"');
    expect(switcher).toContain('activeCategory === "stone" ? learnMoreHref : getPanelPagePath("stone", lang)');
    expect(switcher).toContain('activeCategory === "mineral" ? learnMoreHref : getPanelPagePath("mineral", lang)');
    expect(switcher).toContain('const allPanelsHref = activeCategory ? homePath : `${homePath}#about`');
    expect(switcher).toContain('const allPanelsOption = { href: allPanelsHref, label: t("nav.allPanels"), active: !activeCategory }');
    expect(switcher).toMatch(/const options = \[allPanelsOption, \.\.\.panelOptions\]/);
    expect(switcher).toContain('active: activeCategory === "stone"');
    expect(switcher).toContain('active: activeCategory === "mineral"');
    expect(switcher).toContain('variant={active ? "primary" : "outline"}');
    expect(switcher).toContain('min-h-[4.5rem] w-full flex-col gap-1 whitespace-normal px-4 py-2');
    expect(switcher).toContain('sm:min-h-[5.25rem]');
    expect(switcher).toContain('{active && <span class="panel-switch__cta font-bold leading-none text-ink normal-case tracking-normal">{t("header.btnMore")}</span>}');
    expect(switcher).toContain('font-size: clamp(0.8125rem, 1vw, 0.9375rem)');
    expect(cs["header.btnMore"]).toBe("Chci vědět víc");
    expect(en["header.btnMore"]).toBe("Learn more");
    expect(switcher).toContain('variant={active ? "primary" : "outline"}');
    expect(switcher).toContain('aria-current={active ? "page" : undefined}');
    expect(switcher).toContain('max-w-6xl grid-cols-1 gap-3 sm:grid-cols-3');
    expect(switcher).toContain('min-h-[4.5rem] w-full flex-col gap-1 whitespace-normal px-4 py-2');
    expect(switcher).toContain('sm:min-h-[5.25rem]');
    expect(header).toContain('"text-[clamp(2.25rem,11.5vw,4.5rem)] sm:text-7xl lg:text-[7.5rem]"');
    expect(header).toContain('"hero-title__label--home": home');
    expect(header).toContain("items-center gap-6 pt-[calc(var(--nav-height)+4rem)] pb-20 text-center");
    expect(header).toContain('<PanelCategorySwitch lang={lang} activeCategory={panelCategory} />');
    expect(header).toContain('class="w-64 justify-center max-md:hidden!"');
    expect(header).toContain('class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 lg:hidden!"');
    const sectionHeader = await Bun.file("src/components/ui/SectionHeader.astro").text();
    expect(sectionHeader).toContain('layout = "center"');
    expect(sectionHeader).toContain('layout === "center" && "mx-auto flex max-w-3xl flex-col items-center gap-5 text-center"');
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();
    expect(priceList).toContain('class="reveal flex flex-col items-center gap-3 text-center short:gap-2"');
    const panelLanding = await Bun.file("src/components/pages/PanelLanding.astro").text();
    expect(panelLanding).toContain('class="flex max-w-3xl flex-col items-center gap-3 text-center"');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".hero-title__label {");
    expect(effects).toContain(".hero-title__label--home {");
    expect(effects).toContain("width: max-content");
    expect(effects).toContain("white-space: nowrap");
    expect(effects).toContain("color-mix(in srgb, var(--color-fg) 55%, transparent)");
    expect(effects).toContain("0 0 0.34em rgb(36 32 26 / 0.42)");
  });

  test("persistent panel navigation offers home, stone, and mineral destinations", async () => {
    const component = await Bun.file("src/components/nav/PanelNavSwitch.astro").text();
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();

    expect(component).toContain('href: homePath, label: t("nav.allPanels"), active: isHomePage');
    expect(component).toContain('getPanelPagePath("stone", lang)');
    expect(component).toContain('getPanelPagePath("mineral", lang)');
    expect(component).toContain('aria-current={active ? "page" : undefined}');
    expect(nav).toContain('<PanelNavSwitch lang={lang} panelCategory={panelCategory} isHomePage={isHomePage} />');
    expect(nav).toContain('variant="panel"');
    expect(cs["nav.panels"]).toBe("Svítící panely");
    expect(en["nav.panels"]).toBe("Illuminated panels");
    expect(cs["nav.info"]).toBe("Informace");
    expect(en["nav.info"]).toBe("Information");
  });

  test("brand tagline is present in the desktop navigation on every page type", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();

    expect(nav).toContain('{t("header.title")}');
    expect(nav).toContain('class="hidden text-[0.625rem] tracking-[0.18em] text-fg-muted uppercase sm:block xl:hidden 2xl:block"');
    expect(nav).not.toContain("!panelCategory &&");
  });

  test("desktop and mobile navigation use the requested panel, sections, info, price, contact order", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const menus = [
      nav.match(/<ul class="hidden items-center gap-3 min-\[1200px\]:flex 2xl:gap-8">([\s\S]*?)<\/ul>/)?.[1],
      nav.match(/<ul class="flex flex-col">([\s\S]*?)<\/ul>/)?.[1],
    ];

    for (const menu of menus) {
      expect(menu).toBeDefined();
      const positions = [
        menu!.indexOf("<PanelNavSwitch"),
        menu!.indexOf("{homeLinks.map"),
        menu!.indexOf("<InfoNavItem"),
        menu!.indexOf("<PriceNavItem"),
        menu!.indexOf("<NavItem {...contactLink"),
      ];
      expect(positions.every((position, index) => position >= 0 && (index === 0 || positions[index - 1]! < position))).toBe(true);
    }
  });

  test("panel hero places a gold home icon under video controls and matches CTA sizes", async () => {
    const cs = await Bun.file("src/i18n/cs.json").json();
    const en = await Bun.file("src/i18n/en.json").json();
    const header = await Bun.file("src/components/header/Header.astro").text();
    const nav = await Bun.file("src/components/nav/Nav.astro").text();

    expect(cs["nav.home"]).toBe("Domů");
    expect(en["nav.home"]).toBe("Home");
    expect(header).toContain('{!home && panelCategory && (');
    expect(header).toContain('{(home || panelCategory) && (');
    expect(header).toContain('const headerModelPath = panelCategory === "mineral"');
    expect(header).toContain(': STONE_AR_MODEL_PATH;');
    expect(header).toMatch(/size="sm"\s+id="headerArButton"/);
    expect(header).toContain('<Icon name="home" class="size-5" />');
    expect(header).toContain('aria-label={t("nav.home")}');
    expect(header).toContain('class="hero-home-link absolute z-10 grid size-11');
    expect(header).not.toContain('id="headerMoreButton"');
    expect(header).toMatch(/<Button\s+variant="outline"\s+size="sm"\s+id="headerArButton"[\s\S]*?class="w-64/);
    expect(nav).not.toContain('<Icon name="home"');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".hero-home-link {");
    expect(effects).toContain("inset-block-start: calc(var(--nav-height) + 1.5rem + 3.25rem)");
    expect(nav).toContain('const contactLink = {');
  });

  test("FAQ appears after day/night on home and has dedicated localized pages", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const home = await Bun.file("src/components/pages/HomeLanding.astro").text();
    const panelLanding = await Bun.file("src/components/pages/PanelLanding.astro").text();
    const faqPage = await Bun.file("src/pages/faq.astro").text();
    const enFaqPage = await Bun.file("src/pages/en/faq.astro").text();
    const schema = await Bun.file("src/lib/structured-data.ts").text();

    expect(nav).not.toContain('text: t("nav.dayNight")');
    const infoNav = await Bun.file("src/components/nav/InfoNavItem.astro").text();
    expect(infoNav).toContain('{ href: `${basePath}/#faq`, label: t("nav.faq") }');
    expect(infoNav).not.toContain('{ href: `${basePath}/faq/`, label: t("nav.faq") }');
    expect(home).toContain('import Faq from "../sections/Faq.astro";');
    expect(home.indexOf("<HomeDayNight lang={lang} />")).toBeLessThan(home.indexOf('<Faq id="faq" lang={lang} />'));
    expect(home.indexOf('<Faq id="faq" lang={lang} />')).toBeLessThan(home.indexOf('<Contact id="contact"'));
    expect(panelLanding).toContain("/faq/");
    expect(faqPage).toContain('<Faq id="faq" lang={lang} standalone />');
    expect(enFaqPage).toContain('<Faq id="faq" lang={lang} standalone />');
    expect(faqPage).toContain('t("meta.titleFaq")');
    expect(enFaqPage).toContain('t("meta.titleFaq")');
    expect(schema).toContain('export function faqPageStructuredData');
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
    expect(comparison).toContain("border border-line-strong text-left");
    expect(comparison).toContain("border-t border-line-strong bg-ink-850");
    expect(comparison).toContain("odd:bg-ink-850/50 hover:bg-ink-900");
  });

  test("contact form choices and submit action have clear high-contrast states", async () => {
    const contact = await Bun.file("src/components/sections/Contact.astro").text();

    expect(contact.match(/border-line-bold bg-ink-900 px-/g)?.length).toBe(3);
    expect(contact.match(/has-checked:bg-gold has-checked:text-ink/g)?.length).toBe(3);
    expect(contact).toContain('class="contact-form__submit self-start shadow-glow');
  });

  test("contact form keeps mobile size and version choices compact with unknown centered below", async () => {
    const contact = await Bun.file("src/components/sections/Contact.astro").text();

    expect(contact).toContain('class="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2"');
    expect(contact).toContain('size === "" && "col-span-4 mx-auto w-fit min-w-36');
    expect(contact).toContain('class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2"');
    expect(contact).toContain('version === "" && "col-span-3 mx-auto w-fit min-w-36');
    expect(contact).toContain('class="contact-form flex h-full flex-col gap-3 sm:gap-5');
    expect(contact).toContain('class="grid grid-cols-2 gap-2 sm:gap-5"');
    expect(contact).toContain('rows="2"');
  });

  test("contact section moves its heading closer to the header when opened by an inquiry link", async () => {
    const contact = await Bun.file("src/components/sections/Contact.astro").text();
    const styles = await Bun.file("src/styles/global.css").text();

    expect(contact).toContain('class="contact-section home-section-y home-section-divider bg-ink-800"');
    expect(styles).toContain("main > section[id]:not(#panel-material):not(.pricing):target,");
    expect(styles).toContain("padding-block-start: 1rem;");
  });

  test("showroom keeps its phone while panel branch showroom CTA links to e-mail", async () => {
    const contactSection = await Bun.file("src/components/sections/Contact.astro").text();
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();

    expect(contactSection).toContain('href="tel:+420601221551"');
    expect(contactSection).toContain('<Icon name="phone" class="size-5" />');
    expect(priceList).toContain('href={`mailto:${contact.email}`}');
    expect(priceList).toContain("{contact.email} →");
    expect(priceList).not.toContain('href="tel:+420601221551"');
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
