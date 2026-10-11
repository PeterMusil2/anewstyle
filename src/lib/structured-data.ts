/**
 * Extra JSON-LD for the home page: the three panel versions as Products with
 * per-size Offers, the illustrative stone patterns, the FAQ and the Brno
 * showroom. Merged into the @graph built by StructuredData.astro.
 */
import {
  CURRENCY,
  SITE_URL,
  contact,
  getFaq,
  getPatterns,
  getVersions,
  sizes,
  type Lang,
} from "./site-data";

export function homeStructuredData(lang: Lang, pageUrl: string): Record<string, unknown>[] {
  const organizationId = `${SITE_URL}/#organization`;
  const brand = { "@type": "Brand", name: contact.brand };
  const panelName = lang === "cs" ? "Svítící kamenný panel" : "Illuminated stone panel";
  const sizeLabel = lang === "cs" ? "velikost" : "size";

  const products = getVersions(lang).map((version) => {
    const net = version.prices.map((price) => price.priceExclVat);
    return {
      "@type": "Product",
      "@id": `${pageUrl}#product-${version.name.toLowerCase()}`,
      name: `${panelName} ${version.name}`,
      description: version.tagline,
      brand,
      manufacturer: { "@id": organizationId },
      category: lang === "cs" ? "Designové interiérové osvětlení" : "Designer interior lighting",
      material: lang === "cs" ? "Přírodní kámen (břidlice, pískovec)" : "Natural stone (slate, sandstone)",
      image: `${SITE_URL}/images/showcase/rockfoil_pink_light_frame_mirror.webp`,
      url: `${pageUrl}#price-list`,
      additionalProperty: version.features
        .filter((feature) => feature.included)
        .map((feature) => ({ "@type": "PropertyValue", name: feature.feature, value: true })),
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: CURRENCY,
        lowPrice: Math.min(...net),
        highPrice: Math.max(...net),
        offerCount: version.prices.length,
        seller: { "@id": organizationId },
        offers: version.prices.map((price, index) => ({
          "@type": "Offer",
          name: `${version.name} – ${sizeLabel} ${price.size} (${price.dimensionsMm} mm)`,
          sku: `${version.name}-${sizes[index]?.label ?? price.size}`,
          price: price.priceExclVat,
          priceCurrency: CURRENCY,
          url: `${pageUrl}#price-list`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: price.priceExclVat,
            priceCurrency: CURRENCY,
            valueAddedTaxIncluded: false,
          },
          seller: { "@id": organizationId },
        })),
      },
    };
  });

  const patterns = {
    "@type": "ItemList",
    "@id": `${pageUrl}#stone-patterns`,
    name: lang === "cs" ? "Ilustrační vzory kamenných dekorů" : "Illustrative stone patterns",
    itemListElement: getPatterns(lang).map((pattern, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "CreativeWork",
        name: pattern.name,
        description: pattern.description,
        image: pattern.image,
      },
    })),
  };

  const faqPage = {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    inLanguage: lang,
    mainEntity: getFaq(lang).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  const showroom = {
    "@type": "Store",
    "@id": `${SITE_URL}/#showroom`,
    name: `${contact.brand} Showroom`,
    description: contact.showroom.note[lang],
    parentOrganization: { "@id": organizationId },
    telephone: contact.phone,
    email: contact.email,
    url: `${pageUrl}#contact`,
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
  };

  return [...products, patterns, faqPage, showroom];
}
