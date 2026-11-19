/**
 * Shared price calculations for the website and machine-readable site data.
 * The CMS price file stores prices as localized strings, so parse them once
 * here and keep the mineral surcharge in that same file as the source of truth.
 */
import prices from "../data/prices.json";
import type { Price, PricesData } from "../components/sections/PriceList.types";

export type PanelCategory = "stone" | "mineral";
export type SizeKey = keyof Price;

/** Feature labels which differ between stone and mineral panels. */
export const MINERAL_FEATURE_KEYS = new Set(["1", "2", "4"]);

const pricesData = prices as PricesData;

const parsePrice = (value: string): number => Number(value.replace(/\s/g, ""));

export const PANEL_WIDTH_MM: Record<SizeKey, number> = { l: 400, xl: 600, xxl: 800, xxxl: 1200 };

/** Positions of the internal joins across the complete set, in percent. */
export function stoneSetSeams(panels: readonly SizeKey[]): number[] {
  const total = panels.reduce((width, size) => width + PANEL_WIDTH_MM[size], 0);
  let offset = 0;
  return panels.slice(0, -1).map((size) => {
    offset += PANEL_WIDTH_MM[size];
    return offset / total * 100;
  });
}

/** A set price is the price of the whole composition, not a unit price. */
export function getStonePanelSets(lang: "cs" | "en") {
  return (pricesData.stoneSets ?? []).map(({ panels, prices: setPrices }) => ({
    id: panels.join("-"),
    label: panels.map((size) => size.toUpperCase()).join(" + "),
    panels,
    prices: pricesData.products.flatMap((product) => {
      const net = setPrices[product.title];
      if (!(net > 0)) return [];
      return [{
        version: product.title,
        priceExclVat: net,
        priceInclVat: Math.round(net * 1.21),
        note: product.setPriceNote?.[lang],
      }];
    }),
  }));
}

/** Mineral surcharge in CZK excluding VAT, configured per size in prices.json. */
export function mineralSurcharge(size: SizeKey): number {
  const surcharge = pricesData.mineralSurcharge?.[size];
  return surcharge ? parsePrice(surcharge) : 0;
}

/** Price in CZK excluding VAT for one version, size, and panel category. */
export function priceFor(
  product: { prices: Price },
  size: SizeKey,
  category: PanelCategory,
): number {
  const stonePrice = parsePrice(product.prices[size]);
  return stonePrice + (category === "mineral" ? mineralSurcharge(size) : 0);
}
