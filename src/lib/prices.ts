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
