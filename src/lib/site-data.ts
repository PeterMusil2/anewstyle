/**
 * One source of truth for the facts about ANEW STYLE that machines read:
 * JSON-LD (StructuredData), /llms.txt, /agent/site.json, the WebMCP tools in
 * the browser and the /mcp server. Content still comes from the CMS-edited
 * files (prices.json, faq.json, content/products).
 */
import prices from "../data/prices.json";
import faq from "../data/faq.json";
import type { PricesData, Price } from "../components/sections/PriceList.types";
import cs from "../i18n/cs.json";
import en from "../i18n/en.json";

export type Lang = "cs" | "en";
export type SizeKey = keyof Price;

export const SITE_URL = "https://anewstyle.cz";
export const ESHOP_URL = "https://www.anewstyle-eshop.cz/";
export const VAT_RATE = 0.21;
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

export const toNumber = (value: string): number => Number(value.replace(/\s/g, ""));
export const withVat = (net: number): number => Math.round(net * (1 + VAT_RATE));

/** Panel versions with prices for every size (CZK, excl. and incl. VAT). */
export function getVersions(lang: Lang) {
  return (prices as PricesData).products.map((product) => ({
    id: product.id,
    name: product.title,
    tagline: product.tagline?.[lang] ?? "",
    prices: sizes.map((size) => {
      const net = toNumber(product.prices[size.key]);
      return {
        size: size.label,
        dimensionsMm: `${size.heightMm} × ${size.widthMm}`,
        priceExclVat: net,
        priceInclVat: withVat(net),
      };
    }),
    features: Object.entries(product.features).map(([key, included]) => ({
      feature: translate(lang, `price.feature${key}`),
      included,
    })),
  }));
}

export function getFaq(lang: Lang) {
  return faq.items.map((item) => ({
    question: item.question[lang],
    answer: item.answer[lang].replace(/\*\*(.+?)\*\*/g, "$1"),
  }));
}

interface PatternFrontmatter {
  id: number;
  title: string;
  description?: string;
  descriptionEn?: string;
  imgLight: string;
  modelHorizontal3d?: string;
  modelVertical3d?: string;
}

const asset = (folder: string, value?: string) =>
  value ? new URL(value.startsWith("/") ? value : `${folder}/${value}`, SITE_URL).href : undefined;

/** Illustrative stone patterns from src/content/products. */
export function getPatterns(lang: Lang) {
  const files = import.meta.glob<{ frontmatter: PatternFrontmatter }>(
    "../content/products/*.md",
    { eager: true },
  );
  return Object.values(files)
    .map(({ frontmatter: data }) => data)
    .sort((a, b) => a.id - b.id)
    .map((data) => ({
      name: data.title,
      description: (lang === "en" ? data.descriptionEn : data.description) ?? "",
      image: asset("/images/products", data.imgLight),
      model3d: asset("/3d/products", data.modelHorizontal3d ?? data.modelVertical3d),
    }));
}

/** Everything an agent needs, in one language. */
export function getSiteData(lang: Lang) {
  const base = lang === "cs" ? SITE_URL : `${SITE_URL}/en`;
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
    versions: getVersions(lang),
    patterns: getPatterns(lang),
    patternsNote: translate(lang, "products.samplesNote"),
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
      contactForm: `${base}/#contact`,
    },
    pages: {
      home: `${base}/`,
      priceList: `${base}/#price-list`,
      gallery: `${base}/gallery/`,
      manual: `${base}/manual/`,
    },
  };
}

export type SiteData = ReturnType<typeof getSiteData>;
