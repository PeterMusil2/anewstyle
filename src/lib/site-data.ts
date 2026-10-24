/**
 * One source of truth for the facts about ANEW STYLE that machines read:
 * JSON-LD (StructuredData), /llms.txt, /agent/site.json, the WebMCP tools in
 * the browser and the /mcp server. Content still comes from the CMS-edited
 * files (prices.json, faq.json, products.json). Both panel categories –
 * stone and mineral – are covered, like on the pages.
 */
import prices from "../data/prices.json";
import productsData from "../data/products.json";
import type { PricesData, Price } from "../components/sections/PriceList.types";
import { faqItems } from "./faq";
import { mineralPatternTitle } from "./pattern-fan";
import { MINERAL_FEATURE_KEYS, mineralSurcharge, priceFor, type PanelCategory } from "./prices";
import cs from "../i18n/cs.json";
import en from "../i18n/en.json";

export type Lang = "cs" | "en";
export type SizeKey = keyof Price;

export const SITE_URL = "https://anewstyle.cz";
const ESHOP_URL = "https://www.anewstyle-eshop.cz/";
const VAT_RATE = 0.21;
export const CURRENCY = "CZK";

export const contact = {
  brand: "ANEW STYLE",
  company: "OSM s.r.o.",
  email: "info@anewstyle.cz",
  phone: "+420601221551",
  phoneDisplay: "+420 601 221 551",
  companyId: "47903180",
  vatId: "CZ47903180",
  billingAddress: {
    street: "Hudcova 86/54",
    postalCode: "621 00",
    city: "Brno",
    country: "CZ",
  },
  showroom: {
    street: "Hybešova 61",
    postalCode: "602 00",
    city: "Brno",
    country: "CZ",
    latitude: 49.1887733,
    longitude: 16.5990534,
    mapUrl:
      "https://www.google.cz/maps/place/Hybe%C5%A1ova+308%2F61,+602+00+Brno-st%C5%99ed/@49.1887768,16.5968647,17z",
    note: {
      cs: "Prohlídka po předchozí domluvě.",
      en: "Visits by appointment.",
    },
  },
  social: [
    "https://www.facebook.com/profile.php?id=100088855596654",
    "https://www.instagram.com/anewstyle.cz/",
  ],
} as const;

export const sizes: { key: SizeKey; label: string; widthMm: number; heightMm: number }[] = [
  { key: "l", label: "L", widthMm: 400, heightMm: 2400 },
  { key: "xl", label: "XL", widthMm: 600, heightMm: 2400 },
  { key: "xxl", label: "XXL", widthMm: 800, heightMm: 2400 },
  { key: "xxxl", label: "XXXL", widthMm: 1200, heightMm: 2400 },
];

const dictionaries = { cs, en } as const;
const translate = (lang: Lang, key: string): string =>
  (dictionaries[lang] as Record<string, string>)[key] ??
  (dictionaries.cs as Record<string, string>)[key] ??
  key;

const withVat = (net: number): number => Math.round(net * (1 + VAT_RATE));

/** The two panel categories the site switches between (stone / mineral). */
export function getPanelCategories(lang: Lang): { id: PanelCategory; name: string; description: string }[] {
  return [
    { id: "stone", name: translate(lang, "price.categoryStone"), description: translate(lang, "tech.desc") },
    { id: "mineral", name: translate(lang, "price.categoryMineral"), description: translate(lang, "tech.mineralDesc") },
  ];
}

/**
 * Panel versions with prices for every size (CZK, excl. and incl. VAT), for
 * stone panels and – stone price + per-size surcharge – mineral panels.
 */
export function getVersions(lang: Lang) {
  return (prices as PricesData).products.map((product, index) => ({
    id: String(index + 1),
    name: product.title,
    tagline: product.tagline?.[lang] ?? "",
    prices: sizes.map((size) => {
      const net = priceFor(product, size.key, "stone");
      const mineralNet = priceFor(product, size.key, "mineral");
      return {
        size: size.label,
        dimensionsMm: `${size.heightMm} × ${size.widthMm}`,
        priceExclVat: net,
        priceInclVat: withVat(net),
        mineralPriceExclVat: mineralNet,
        mineralPriceInclVat: withVat(mineralNet),
      };
    }),
    features: Object.entries(product.features).map(([key, included]) => ({
      feature: translate(lang, `price.feature${key}`),
      ...(MINERAL_FEATURE_KEYS.has(key) ? { featureMineral: translate(lang, `price.feature${key}Mineral`) } : {}),
      included,
    })),
  }));
}

/** Per-size surcharge for mineral panels (CZK excl. VAT, same for every version). */
export function getMineralSurcharge() {
  return sizes.map((size) => ({ size: size.label, surchargeExclVat: mineralSurcharge(size.key) }));
}

const plainText = (markdown: string) => markdown.replace(/\*\*(.+?)\*\*/g, "$1");

/**
 * FAQ; `answerMineral` only where mineral panels differ, `stoneOnly` for
 * questions the site hides in the mineral view.
 */
export function getFaq(lang: Lang) {
  return faqItems(lang).map((item) => {
    const answer = plainText(item.answer);
    const mineral = plainText(item.mineralAnswer);
    return {
      question: item.question,
      answer,
      ...(mineral !== answer ? { answerMineral: mineral } : {}),
      ...(item.hideInMineral ? { stoneOnly: true } : {}),
    };
  });
}

const asset = (folder: string, value?: string) =>
  value ? new URL(/^(\/|https?:)/.test(value) ? value : `${folder}/${value}`, SITE_URL).href : undefined;

/** Mineral decors (src/data/products.json → mineral, ordered in the CMS). */
export function getMineralPatterns(lang: Lang) {
  return productsData.mineral.map((pattern, index) => ({
    name: mineralPatternTitle(pattern.title, index, translate(lang, "products.mineralPattern")),
    image: asset("/images/patterns", pattern.image),
  }));
}

/** Illustrative stone patterns (src/data/products.json, ordered in the CMS). */
export function getPatterns() {
  return productsData.items.map((item) => ({
    name: item.title,
    image: asset("/images/products", item.imgLight),
    model3d: asset("/3d/products", item.modelHorizontal3d || item.modelVertical3d),
  }));
}

/** Everything an agent needs, in one language. */
export function getSiteData(lang: Lang) {
  const base = lang === "cs" ? SITE_URL : `${SITE_URL}/en`;
  const stonePanels = `${SITE_URL}${lang === "cs" ? "/svitici-kamenne-panely/" : "/en/illuminated-stone-panels/"}`;
  const mineralPanels = `${SITE_URL}${lang === "cs" ? "/svitici-mineralni-panely/" : "/en/illuminated-mineral-panels/"}`;
  return {
    name: contact.brand,
    description: translate(lang, "meta.description"),
    language: lang,
    url: `${base}/`,
    currency: CURRENCY,
    vatRate: VAT_RATE,
    priceNote: translate(lang, "price.vat"),
    customSizeNote: translate(lang, "price.customDesc"),
    sizes: sizes.map((size) => ({
      size: size.label,
      dimensionsMm: `${size.heightMm} × ${size.widthMm}`,
    })),
    panelCategories: getPanelCategories(lang),
    versions: getVersions(lang),
    mineralSurcharge: getMineralSurcharge(),
    patterns: getPatterns(),
    patternsNote: translate(lang, "products.samplesNote"),
    mineralPatterns: getMineralPatterns(lang),
    mineralPatternsNote: translate(lang, "products.mineralArHint"),
    faq: getFaq(lang),
    contact: {
      email: contact.email,
      phone: contact.phoneDisplay,
      showroom: `${contact.showroom.street}, ${contact.showroom.postalCode} ${contact.showroom.city}`,
      showroomNote: contact.showroom.note[lang],
      company: `${contact.company}, ${contact.billingAddress.street}, ${contact.billingAddress.postalCode} ${contact.billingAddress.city}`,
      companyId: contact.companyId,
      vatId: contact.vatId,
      eshop: ESHOP_URL,
      contactForm: `${stonePanels}#contact`,
    },
    pages: {
      home: `${base}/`,
      stonePanels,
      mineralPanels,
      priceList: `${stonePanels}#price-list`,
      gallery: `${base}/gallery/`,
      manual: `${base}/manual/`,
    },
  };
}

export type SiteData = ReturnType<typeof getSiteData>;
