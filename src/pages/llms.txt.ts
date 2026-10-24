/**
 * /llms.txt – a plain-Markdown summary of the site for LLMs and AI agents
 * (https://llmstxt.org). Generated from the same data as the pages.
 */
import type { APIRoute } from "astro";
import { getSiteData, SITE_URL, type Lang, type SiteData } from "../lib/site-data";

const czk = (value: number) => `${value.toLocaleString("cs-CZ")} Kč`;

const section = (data: SiteData, lang: Lang): string => {
  const h = lang === "cs"
    ? { categories: "Typy panelů", prices: "Ceník – kamenné panely", mineralPrices: "Ceník – minerální panely", surcharge: "Příplatek za minerální panel (bez DPH, stejný pro všechna provedení)", version: "Provedení", size: "Velikost", excl: "bez DPH", incl: "s DPH", features: "Výbava", mineralFeatures: "U minerálních panelů se liší", patterns: "Ilustrační vzory kamene", mineralPatterns: "Minerální dekory", faq: "Časté dotazy", mineralAnswer: "U minerálních panelů", stoneOnly: "Platí jen pro kamenné panely.", contact: "Kontakt", companyId: "IČ", vatId: "DIČ" }
    : { categories: "Panel types", prices: "Price list – stone panels", mineralPrices: "Price list – mineral panels", surcharge: "Mineral panel surcharge (excl. VAT, same for every version)", version: "Version", size: "Size", excl: "excl. VAT", incl: "incl. VAT", features: "Features", mineralFeatures: "Different for mineral panels", patterns: "Illustrative stone patterns", mineralPatterns: "Mineral decors", faq: "FAQ", mineralAnswer: "For mineral panels", stoneOnly: "Applies to stone panels only.", contact: "Contact", companyId: "Company ID", vatId: "VAT ID" };

  const priceRows = data.versions.flatMap((version) =>
    version.prices.map(
      (price) =>
        `| ${version.name} | ${price.size} (${price.dimensionsMm} mm) | ${czk(price.priceExclVat)} | ${czk(price.priceInclVat)} |`,
    ),
  );

  const mineralRows = data.versions.flatMap((version) =>
    version.prices.map(
      (price) =>
        `| ${version.name} | ${price.size} (${price.dimensionsMm} mm) | ${czk(price.mineralPriceExclVat)} | ${czk(price.mineralPriceInclVat)} |`,
    ),
  );
  const mineralFeatureNotes = (data.versions[0]?.features ?? [])
    .filter((feature) => feature.featureMineral)
    .map((feature) => `${feature.feature} → ${feature.featureMineral}`);

  const featureHeader = `| ${h.features} | ${data.versions.map((v) => v.name).join(" | ")} |`;
  const featureRows = data.versions[0]?.features.map(
    (feature, index) =>
      `| ${feature.feature} | ${data.versions.map((v) => (v.features[index]?.included ? "✓" : "–")).join(" | ")} |`,
  ) ?? [];

  return [
    `## ${h.categories} (${lang.toUpperCase()})`,
    "",
    ...data.panelCategories.map((category) => `- **${category.name}** – ${category.description}`),
    "",
    `## ${h.prices}`,
    "",
    data.priceNote,
    data.customSizeNote,
    "",
    `| ${h.version} | ${h.size} | ${h.excl} | ${h.incl} |`,
    "| --- | --- | ---: | ---: |",
    ...priceRows,
    "",
    ...data.versions.map((v) => `- **${v.name}** – ${v.tagline}`),
    "",
    featureHeader,
    `| --- | ${data.versions.map(() => ":---:").join(" | ")} |`,
    ...featureRows,
    "",
    `## ${h.mineralPrices}`,
    "",
    `${h.surcharge}: ${data.mineralSurcharge.map((s) => `${s.size} +${czk(s.surchargeExclVat)}`).join(", ")}.`,
    ...(mineralFeatureNotes.length ? [`${h.mineralFeatures}: ${mineralFeatureNotes.join("; ")}.`] : []),
    "",
    `| ${h.version} | ${h.size} | ${h.excl} | ${h.incl} |`,
    "| --- | --- | ---: | ---: |",
    ...mineralRows,
    "",
    `## ${h.patterns}`,
    "",
    data.patternsNote,
    "",
    ...data.patterns.map((p) => `- **${p.name}**${p.image ? ` ([foto](${p.image}))` : ""}`),
    "",
    `## ${h.mineralPatterns}`,
    "",
    data.mineralPatternsNote,
    "",
    ...data.mineralPatterns.map((p) => `- **${p.name}**${p.image ? ` ([foto](${p.image}))` : ""}`),
    "",
    `## ${h.faq}`,
    "",
    ...data.faq.flatMap((item) => [
      `### ${item.question}`,
      "",
      item.answer,
      ...("answerMineral" in item && item.answerMineral ? ["", `*${h.mineralAnswer}:* ${item.answerMineral}`] : []),
      ...("stoneOnly" in item && item.stoneOnly ? ["", `*${h.stoneOnly}*`] : []),
      "",
    ]),
    `## ${h.contact}`,
    "",
    `- E-mail: ${data.contact.email}`,
    `- Tel.: ${data.contact.phone}`,
    `- Showroom: ${data.contact.showroom} (${data.contact.showroomNote})`,
    `- ${data.contact.company}, ${h.companyId} ${data.contact.companyId}, ${h.vatId} ${data.contact.vatId}`,
    `- E-shop: ${data.contact.eshop}`,
    "",
  ].join("\n");
};

export const GET: APIRoute = () => {
  const cs = getSiteData("cs");
  const en = getSiteData("en");

  const body = [
    "# ANEW STYLE",
    "",
    "> Velkoplošné svítící panely z přírodního kamene (břidlice, pískovec) a z minerální desky – designové interiérové osvětlení vyráběné v Brně. / Large illuminated natural-stone and mineral panels – designer interior lighting made in Brno, Czech Republic.",
    "",
    "## Pro agenty / For agents",
    "",
    `- [Strukturovaná data / Structured data (JSON)](${SITE_URL}/agent/site.json): stone and mineral panels – prices, versions, sizes, patterns, FAQ, contact in cs + en.`,
    `- MCP server (Streamable HTTP, read-only tools): ${SITE_URL}/mcp`,
    "- WebMCP: the pages register tools via the browser's Model Context API (get_price_list, list_stone_patterns, list_mineral_patterns, search_faq, get_contact, show_price_for_size, prefill_inquiry).",
    "- Poptávku odešle vždy člověk – agent může formulář jen předvyplnit. / A human always sends the inquiry; agents may only prefill the form.",
    "",
    "## Stránky / Pages",
    "",
    `- [Domů / Home (cs)](${cs.pages.home}) · [en](${en.pages.home})`,
    `- [Svítící kamenné panely / Illuminated stone panels (cs)](${cs.pages.stonePanels}) · [en](${en.pages.stonePanels})`,
    `- [Svítící minerální panely / Illuminated mineral panels (cs)](${cs.pages.mineralPanels}) · [en](${en.pages.mineralPanels})`,
    `- [Ceník / Price list](${cs.pages.priceList}) · [en](${en.pages.priceList})`,
    `- [Galerie / Gallery](${cs.pages.gallery}) · [en](${en.pages.gallery})`,
    `- [Návody / Manuals](${cs.pages.manual}) · [en](${en.pages.manual})`,
    `- [E-shop](${cs.contact.eshop})`,
    "",
    section(cs, "cs"),
    "---",
    "",
    section(en, "en"),
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
