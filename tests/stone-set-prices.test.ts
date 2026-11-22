import { describe, expect, test } from "bun:test";
import prices from "../src/data/prices.json";
import { getStonePanelSets, stoneSetSeams } from "../src/lib/prices";
import { getSiteData } from "../src/lib/site-data";
import { panelPageStructuredData } from "../src/lib/structured-data";

describe("stone set prices", () => {
  test("puts joins at cumulative panel widths across one continuous decor", () => {
    expect(stoneSetSeams(["l", "l", "l"]).map(Math.round)).toEqual([33, 67]);
    expect(stoneSetSeams(["xl", "xl"])).toEqual([50]);
    expect(stoneSetSeams(["l", "xxl"])[0]).toBeCloseTo(100 / 3);
  });
  test("uses the CMS set totals per version and calculates VAT", () => {
    const sets = getStonePanelSets("cs");
    expect(sets).toHaveLength(prices.stoneSets.length);
    expect(new Set(sets.map((set) => set.id)).size).toBe(sets.length);
    for (const [index, set] of sets.entries()) {
      const source = prices.stoneSets[index];
      expect(set.panels.length).toBeGreaterThanOrEqual(2);
      expect(set.label).toBe(source.panels.map((size) => size.toUpperCase()).join("/"));
      expect(set.prices.map((price) => price.version)).toEqual(prices.products.map((product) => product.title));
      for (const price of set.prices) {
        expect(price.priceExclVat).toBe(source.prices[price.version as keyof typeof source.prices]);
        expect(price.priceInclVat).toBe(Math.round(price.priceExclVat * 1.21));
      }
    }
  });

  test("exposes whole-set prices separately from single-panel offers", () => {
    expect(getSiteData("cs").stoneSets).toEqual(getStonePanelSets("cs"));
    const url = "https://anewstyle.cz/svitici-kamenne-panely/";
    const setOffers = (category: "stone" | "mineral") => panelPageStructuredData("cs", url, category)
      .filter((item) => String(item["@id"]).startsWith(`${url}#set-`));
    expect(setOffers("stone")).toHaveLength(prices.stoneSets.length * prices.products.length);
    expect(setOffers("mineral")).toHaveLength(0);
  });

  test("gives every product a crawlable image, description and available offer", () => {
    const url = "https://anewstyle.cz/svitici-kamenne-panely/";
    const productGraphs = [
      panelPageStructuredData("cs", url, "stone"),
      panelPageStructuredData("en", url, "stone"),
      panelPageStructuredData("cs", url, "mineral"),
      panelPageStructuredData("en", url, "mineral"),
    ];

    for (const graph of productGraphs) {
      const products = graph.filter((item) => item["@type"] === "Product");
      expect(products.length).toBeGreaterThan(0);

      for (const product of products) {
        expect(String(product.image)).toMatch(/^https:\/\/anewstyle\.cz\//);
        expect(String(product.description).trim().length).toBeGreaterThan(0);

        const offerContainer = product.offers as Record<string, unknown>;
        const offers = Array.isArray(offerContainer.offers)
          ? offerContainer.offers as Record<string, unknown>[]
          : [offerContainer];
        expect(offers.length).toBeGreaterThan(0);
        for (const offer of offers) {
          expect(offer.availability).toBe("https://schema.org/InStock");
          expect(offer.itemCondition).toBe("https://schema.org/NewCondition");
        }
      }
    }
  });
});
