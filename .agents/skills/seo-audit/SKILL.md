---
name: seo-audit
description: Check and improve technical SEO and agent readiness of anewstyle.cz – titles/descriptions, canonical + hreflang (cs/en), Open Graph, JSON-LD (Product, FAQPage, Store, ItemList), sitemap, robots and AI-crawler rules, noindex on pages.dev, llms.txt, /agent/site.json, WebMCP and the /mcp server, Search Console. Use for "SEO", "Google", "structured data", "sitemap", "indexing", "AI agents", or before/after a launch.
---

# SEO and agent audit

## What the site generates (verify, don't rebuild)

| Item | Source |
| --- | --- |
| `<title>`, description, canonical, `hreflang` cs/en + `x-default`, `og:*`, `twitter:*` | `src/layouts/Layout.astro` (props per page), `src/i18n/utils.ts` (`getAlternateLinks`) |
| JSON-LD: Product + AggregateOffer, FAQPage, Store, ItemList, breadcrumbs | `src/lib/structured-data.ts` via `components/seo/StructuredData.astro`; facts from `src/lib/site-data.ts` |
| Sitemap | `@astrojs/sitemap` (i18n links, PDF manuals) + `scripts/postbuild-sitemap-alias.mjs` (`sitemap.xml` alias) |
| `robots.txt` | `public/robots.txt` – search + assistants allowed, training crawlers disallowed, `/admin/` `/api/` disallowed |
| `noindex` on `*.pages.dev` | `public/_headers` |
| Agents | `/llms.txt` (`src/pages/llms.txt.ts`), `/agent/site.json`, WebMCP tools (`components/agent/WebMcp.astro`), read-only MCP server `/mcp` (`functions/mcp.ts`) – all fed by `site-data.ts` |

## Checklist

- Titles ≤ 60 chars, descriptions 120–160, unique per page and language (keys `meta.*` in `src/i18n/*.json`).
- Exactly one `<h1>` per page.
- Every page exists in cs and en, hreflang pairs point at each other, `x-default` → cs.
- `astro.config.mjs → site` = `https://anewstyle.cz/`; `trailingSlash: "always"` consistent in links.
- Images: descriptive alt texts (cs + en), gallery alt from the CMS.
- Structured data valid: <https://search.google.com/test/rich-results> and <https://validator.schema.org/> on `/` and `/en/`. Prices in JSON-LD match `prices.json` (stone; note whether mineral pricing should be exposed too).
- Agent endpoints answer and match the CMS data:
  ```bash
  curl -s https://anewstyle.cz/llms.txt | head
  curl -s https://anewstyle.cz/agent/site.json | head -c 400
  curl -s https://anewstyle.cz/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
  ```
- When content changes (new category, prices, FAQ), `site-data.ts` must carry it to JSON-LD, llms.txt, site.json, WebMCP and MCP – add a test for it.
- Lighthouse SEO 100 on the production domain (on `*.pages.dev` it fails by design).

## Search Console (after a launch or a content overhaul)

Submit `sitemap-index.xml`, inspect the main URLs (`/`, `/en/`, `/gallery/`, `/en/gallery/`) → Request indexing; later check Pages, Core Web Vitals and Enhancements (FAQ).

## Report

Per page and language: title/description lengths, schema types found, rich-results status, Lighthouse SEO, agent endpoints OK/not.
