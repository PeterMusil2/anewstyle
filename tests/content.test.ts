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

const toNumber = (value: string) => Number(value.replace(/\s/g, ""));
const SIZES = ["l", "xl", "xxl", "xxxl"] as const;
const publicFile = (path: string) => existsSync(`public${path}`);

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
    expect(header).toContain('data-texture-path={panelCategory === "mineral" ? "/images/patterns/mineral-2.png" : undefined}');
    expect(header).toContain('text-[clamp(1.75rem,8vw,3rem)] sm:text-6xl lg:text-7xl');
    expect(publicFile("/3d/products/Rockfoil_DARKGOLD_3D_vertical.glb")).toBe(true);
    expect(publicFile("/images/patterns/mineral-2.png")).toBe(true);
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
  test("uses one bilingual composition image for the stone veneer and mineral panel", async () => {
    const component = await Bun.file("src/components/sections/MaterialOverview.astro").text();
    const cs = "Transparentní, litý designový panel s kamennou texturou a vysokým podílem minerálů, který je pevný a skvěle propouští světlo. Jeho tloušťka je 6 mm.";
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

  test("places both panel links above the state control instead of below the images", async () => {
    const component = await Bun.file("src/components/sections/HomeShowcase.astro").text();
    const mobileButtonStyles = "whitespace-normal! leading-tight max-sm:text-[0.625rem]!";
    const stoneButtonAt = component.indexOf('<Button href={stoneHref}');
    const mineralButtonAt = component.indexOf('<Button href={mineralHref}');
    const controlsAt = component.indexOf('name="home-showcase-state"');
    const panelsAt = component.indexOf("class=\"grid grid-cols-2 items-stretch");

    expect(stoneButtonAt).toBeGreaterThan(-1);
    expect(mineralButtonAt).toBeGreaterThan(stoneButtonAt);
    expect(mineralButtonAt).toBeLessThan(controlsAt);
    expect(controlsAt).toBeLessThan(panelsAt);
    expect(component.slice(panelsAt)).not.toContain('<Button href={stoneHref}');
    expect(component.slice(panelsAt)).not.toContain('<Button href={mineralHref}');
    expect(component.slice(stoneButtonAt, controlsAt)).toContain(mobileButtonStyles);
    expect(component.slice(stoneButtonAt, controlsAt)).toContain("home.openStone");
    expect(component.slice(stoneButtonAt, controlsAt)).toContain("home.openMineral");
  });
});

describe("feature disclosures", () => {
  test("uses native expandable cards on the shared home page and preserves anchor targets", async () => {
    const component = await Bun.file("src/components/sections/Features.astro").text();

    expect(component).toContain("features.map((feature)");
    expect(component).toContain('<details class="group/feature">');
    expect(component).not.toContain("<details open=");
    expect(component).toContain('feature.palette && "feature-color-palette"');
    expect(component).toContain("grid-column: 1 / -1;");
    expect(component).toContain("justify-self: center;");
    expect(component).toContain("width: calc((100% - 3.75rem) / 4);");
    const palette = await Bun.file("src/components/palette/Palette.astro").text();
    expect(palette).toContain('<ul class="flex h-12 items-center gap-3"');
    expect(component).toContain("feature-disclosure-indicator");
    expect(component).toContain("openAnchoredFeature();");
    expect(component).toContain("window.addEventListener(\"hashchange\", openAnchoredFeature)");
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
    expect(switcher).toContain('variant={active ? "primary" : "outline"}');
    expect(switcher).toContain('aria-current={active ? "page" : undefined}');
    expect(switcher).toContain('grid-cols-1 gap-2 sm:grid-cols-3');
    expect(header).toContain('"text-[clamp(2.25rem,11.5vw,4.5rem)] sm:text-7xl lg:text-[7.5rem]"');
    expect(header).toContain('"hero-title__label--home": home');
    expect(header).toContain("items-center gap-6 pt-[calc(var(--nav-height)+4rem)] pb-20 text-center");
    expect(header).toContain("flex flex-wrap items-center justify-center gap-4 pt-2");
    const sectionHeader = await Bun.file("src/components/ui/SectionHeader.astro").text();
    expect(sectionHeader).toContain('layout = "center"');
    expect(sectionHeader).toContain('layout === "center" && "mx-auto flex max-w-3xl flex-col items-center gap-5 text-center"');
    const priceList = await Bun.file("src/components/sections/PriceList.astro").text();
    expect(priceList).toContain('class="reveal flex flex-col items-center gap-3 text-center short:gap-2"');
    const panelLanding = await Bun.file("src/components/pages/PanelLanding.astro").text();
    expect(panelLanding).toContain('class="flex flex-col items-center gap-3 text-center"');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".hero-title__label {");
    expect(effects).toContain(".hero-title__label--home {");
    expect(effects).toContain("width: max-content");
    expect(effects).toContain("white-space: nowrap");
    expect(effects).toContain("inset-inline: 18%");
    expect(effects).toContain("rgb(0 0 0 / 0.58) 0%");
    expect(effects).toContain("transparent 74%");
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
    expect(header).toMatch(/<Button\s+variant="outline"\s+id="headerArButton"[\s\S]*?class="w-64/);
    expect(nav).not.toContain('<Icon name="home"');
    const effects = await Bun.file("src/styles/effects.css").text();
    expect(effects).toContain(".hero-home-link {");
    expect(effects).toContain("inset-block-start: calc(var(--nav-height) + 1.5rem + 3.25rem)");
    expect(nav).toContain('const mobileLinks = links');
  });

  test("FAQ has a dedicated localized page and menu links", async () => {
    const nav = await Bun.file("src/components/nav/Nav.astro").text();
    const home = await Bun.file("src/components/pages/HomeLanding.astro").text();
    const panelLanding = await Bun.file("src/components/pages/PanelLanding.astro").text();
    const faqPage = await Bun.file("src/pages/faq.astro").text();
    const enFaqPage = await Bun.file("src/pages/en/faq.astro").text();
    const schema = await Bun.file("src/lib/structured-data.ts").text();

    expect(nav).not.toContain('text: t("nav.dayNight")');
    expect(nav.match(/href: `\$\{basePath\}\/faq\/`, text: t\("nav\.faq"\)/g)).toHaveLength(2);
    expect(home).not.toContain('<Faq id="faq"');
    expect(home).not.toContain("<Faq ");
    expect(panelLanding).toContain("/faq/");
    expect(faqPage).toContain('<Faq id="faq" lang={lang} />');
    expect(enFaqPage).toContain('<Faq id="faq" lang={lang} />');
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
