/** Category-specific product, pattern and showroom JSON-LD. */
import {
  CURRENCY,
  SITE_URL,
  contact,
  getFaq,
  getMineralPatterns,
  getPatterns,
  getVersions,
  sizes,
  type Lang,
} from "./site-data";
import type { PanelCategory } from "./prices";

export function panelPageStructuredData(
  lang: Lang,
  pageUrl: string,
  panelCategory?: PanelCategory,
): Record<string, unknown>[] {
  const organizationId = `${SITE_URL}/#organization`;
  const brand = { "@type": "Brand", name: contact.brand };
  const sizeLabel = lang === "cs" ? "velikost" : "size";
  const categories = {
    stone: {
      panelName: lang === "cs" ? "Svítící kamenný panel" : "Illuminated stone panel",
      material: lang === "cs" ? "Přírodní kámen (břidlice, pískovec)" : "Natural stone (slate, sandstone)",
      image: `${SITE_URL}/images/showcase/rockfoil_pink_light_frame_mirror.webp`,
      idSuffix: "",
      skuPrefix: "",
    },
    mineral: {
      panelName: lang === "cs" ? "Svítící minerální panel" : "Illuminated mineral panel",
      material: lang === "cs" ? "Transparentní rigidní minerální deska 6 mm" : "Transparent rigid 6 mm mineral sheet",
      image: `${SITE_URL}/images/showcase/Mineral_on.png`,
      idSuffix: "-mineral",
      skuPrefix: "M-",
    },
  } as const;

  const productsFor = (category: keyof typeof categories) => {
    const meta = categories[category];
    return getVersions(lang, category).map((version) => {
      const priceOf = (price: (typeof version.prices)[number]) =>
        category === "mineral" ? price.mineralPriceExclVat : price.priceExclVat;
      const net = version.prices.map(priceOf);
      return {
        "@type": "Product",
        "@id": `${pageUrl}#product-${version.name.toLowerCase()}${meta.idSuffix}`,
        name: `${meta.panelName} ${version.name}`,
        description: version.tagline,
        brand,
        manufacturer: { "@id": organizationId },
        category: lang === "cs" ? "Designové interiérové osvětlení" : "Designer interior lighting",
        material: meta.material,
        image: meta.image,
        url: `${pageUrl}#price-list`,
        additionalProperty: version.features
          .filter((feature) => feature.included)
          .map((feature) => ({
            "@type": "PropertyValue",
            name: category === "mineral" && feature.featureMineral ? feature.featureMineral : feature.feature,
            value: true,
          })),
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: CURRENCY,
          lowPrice: Math.min(...net),
          highPrice: Math.max(...net),
          offerCount: version.prices.length,
          seller: { "@id": organizationId },
          offers: version.prices.map((price, index) => ({
            "@type": "Offer",
            name: `${meta.panelName} ${version.name} – ${sizeLabel} ${price.size} (${price.dimensionsMm} mm)`,
            sku: `${meta.skuPrefix}${version.name}-${sizes[index]?.label ?? price.size}`,
            price: priceOf(price),
            priceCurrency: CURRENCY,
            url: `${pageUrl}#price-list`,
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: priceOf(price),
              priceCurrency: CURRENCY,
              valueAddedTaxIncluded: false,
            },
            seller: { "@id": organizationId },
          })),
        },
      };
    });
  };

  const products = panelCategory ? productsFor(panelCategory) : [];

  const patterns = {
    "@type": "ItemList",
    "@id": `${pageUrl}#stone-patterns`,
    name: lang === "cs" ? "Ilustrační vzory kamenných dekorů" : "Illustrative stone patterns",
    itemListElement: getPatterns().map((pattern, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "CreativeWork",
        name: pattern.name,
        image: pattern.image,
      },
    })),
  };

  const mineralPatterns = {
    "@type": "ItemList",
    "@id": `${pageUrl}#mineral-patterns`,
    name: lang === "cs" ? "Minerální dekory" : "Mineral decors",
    itemListElement: getMineralPatterns(lang).map((pattern, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: { "@type": "CreativeWork", name: pattern.name, image: pattern.image },
    })),
  };

  const showroom = panelCategory ? {
    "@type": "Store",
    "@id": `${SITE_URL}/#showroom`,
    name: `${contact.brand} Showroom`,
    description: contact.showroom.note[lang],
    parentOrganization: { "@id": organizationId },
    telephone: contact.phone,
    email: contact.email,
    url: `${SITE_URL}${lang === "cs" ? "/" : "/en/"}?panel=${panelCategory}#contact`,
    image: `${SITE_URL}/images/backgrounds/showroom.webp`,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.showroom.street,
      postalCode: contact.showroom.postalCode,
      addressLocality: contact.showroom.city,
      addressCountry: contact.showroom.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: contact.showroom.latitude,
      longitude: contact.showroom.longitude,
    },
    hasMap: contact.showroom.mapUrl,
  } : undefined;

  return [
    ...products,
    ...(panelCategory === "stone" ? [patterns] : []),
    ...(panelCategory === "mineral" ? [mineralPatterns] : []),
    ...(showroom ? [showroom] : []),
  ];
}

/** Shared FAQ on the home comparison page, with both material answers where they differ. */
export function homePageStructuredData(lang: Lang, pageUrl: string): Record<string, unknown>[] {
  const stoneLabel = lang === "cs" ? "Svítící kamenné panely" : "Illuminated stone panels";
  const mineralLabel = lang === "cs" ? "Svítící minerální panely" : "Illuminated mineral panels";
  const faqPage = {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    inLanguage: lang,
    mainEntity: getFaq(lang).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.stoneOnly
          ? `${stoneLabel}: ${item.answer}`
          : item.answerMineral
            ? `${stoneLabel}: ${item.answer} ${mineralLabel}: ${item.answerMineral}`
            : item.answer,
      },
    })),
  };
  return [faqPage];
}
