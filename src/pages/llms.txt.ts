/**
 * /llms.txt – a plain-Markdown summary of the site for LLMs and AI agents
 * (https://llmstxt.org). Generated from the same data as the pages.
 */
import type { APIRoute } from "astro";
import { getSiteData, SITE_URL, type Lang, type SiteData } from "../lib/site-data";

const czk = (value: number) => `${value.toLocaleString("cs-CZ")} Kč`;

const section = (data: SiteData, lang: Lang): string => {
  const h = lang === "cs"
    ? { prices: "Ceník", version: "Provedení", size: "Velikost", excl: "bez DPH", incl: "s DPH", features: "Výbava", patterns: "Ilustrační vzory kamene", faq: "Časté dotazy", contact: "Kontakt" }
    : { prices: "Price list", version: "Version", size: "Size", excl: "excl. VAT", incl: "incl. VAT", features: "Features", patterns: "Illustrative stone patterns", faq: "FAQ", contact: "Contact" };

  const priceRows = data.versions.flatMap((version) =>
    version.prices.map(
      (price) =>
        `| ${version.name} | ${price.size} (${price.dimensionsMm} mm) | ${czk(price.priceExclVat)} | ${czk(price.priceInclVat)} |`,
    ),
  );

  const featureHeader = `| ${h.features} | ${data.versions.map((v) => v.name).join(" | ")} |`;
  const featureRows = data.versions[0]?.features.map(
    (feature, index) =>
      `| ${feature.feature} | ${data.versions.map((v) => (v.features[index]?.included ? "✓" : "–")).join(" | ")} |`,
  ) ?? [];

  return [
    `## ${h.prices} (${lang.toUpperCase()})`,
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
    `## ${h.patterns}`,
    "",
    data.patternsNote,
    "",
    ...data.patterns.map((p) => `- **${p.name}**${p.description ? ` – ${p.description}` : ""}${p.image ? ` ([foto](${p.image}))` : ""}`),
    "",
    `## ${h.faq}`,
    "",
    ...data.faq.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    `## ${h.contact}`,
    "",
    `- E-mail: ${data.contact.email}`,
    `- Tel.: ${data.contact.phone}`,
    `- Showroom: ${data.contact.showroom} (${data.contact.showroomNote})`,
    `- ${data.contact.company}, IČ ${data.contact.companyId}, DIČ ${data.contact.vatId}`,
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
    "> Velkoplošné svítící panely z přírodního kamene (břidlice, pískovec) – designové interiérové osvětlení vyráběné v Brně. / Large illuminated natural-stone panels – designer interior lighting made in Brno, Czech Republic.",
    "",
    "## Pro agenty / For agents",
    "",
    `- [Strukturovaná data / Structured data (JSON)](${SITE_URL}/agent/site.json): prices, versions, sizes, patterns, FAQ, contact in cs + en.`,
    `- MCP server (Streamable HTTP, read-only tools): ${SITE_URL}/mcp`,
    "- WebMCP: the pages register tools via the browser's Model Context API (get_price_list, list_stone_patterns, search_faq, get_contact, show_price_for_size, prefill_inquiry).",
    "- Poptávku odešle vždy člověk – agent může formulář jen předvyplnit. / A human always sends the inquiry; agents may only prefill the form.",
    "",
    "## Stránky / Pages",
    "",
    `- [Domů / Home (cs)](${cs.pages.home}) · [en](${en.pages.home})`,
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
