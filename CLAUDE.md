# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [`AGENTS.md`](AGENTS.md) first** – project skills (`.agents/skills/`, linked as `.claude/skills/`), the two rules for every change (content in code always gets a CMS equivalent; every change ships with tests) and the step-by-step validation process before anything goes to `master`.

## Project Overview

ANEW STYLE is a Czech product showcase website for illuminated stone panels (Rockfoil). Built with Astro 7 and Tailwind CSS 4, it features internationalization support (CS/EN) and 3D product visualization.

## Commands

```bash
bun run dev          # Astro dev server (http://localhost:4321)
bun run build        # admin:build → images → typecheck → astro build → sitemap alias
bun run typecheck    # astro check (TypeScript 6 API) + tsc from TypeScript 7
bun test             # tests in tests/ (CMS parity, content, image rules)
bun run preview      # serve the production build
bun run cms:local    # local Decap CMS backend, then open /admin/ on the dev server
bun run stylelint    # lint + order CSS in src/**/*.css and <style> in .astro
```

## Architecture

### Internationalization (i18n)

Uses Astro's built-in i18n with URL-based routing:

**Configuration** (`astro.config.mjs`):
- Default locale: `cs` (Czech) - no URL prefix
- Secondary locale: `en` (English) - uses `/en/` prefix
- Example: `/` (Czech), `/en/` (English), `/gallery` (Czech), `/en/gallery` (English)

**Translation System** (`src/i18n/`):
- `cs.json` / `en.json` - All UI translations with flat dotted keys (e.g., `nav.home`, `cookie.accept`), combined in `i18n.ts`; both files must have the same keys (tested)
- `utils.ts` - Helper functions:
  - `getLangFromUrl(url)` - Extract language from URL
  - `useTranslations(lang)` - Returns `t()` function for translations
  - `getLanguageSwitchPath(url, targetLang)` - Get path for language switcher
  - `getAlternateLinks(url)` - Generate hreflang links

**Usage in Components**:
```astro
---
import { useTranslations, type Lang } from "../i18n/utils";
interface Props { lang?: Lang; }
const { lang = 'cs' } = Astro.props;
const t = useTranslations(lang);
---
<h1>{t('nav.home')}</h1>
```

**Page Structure**:
- `/src/pages/index.astro` - Czech homepage
- `/src/pages/gallery.astro` - Czech gallery
- `/src/pages/en/index.astro` - English homepage
- `/src/pages/en/gallery.astro` - English gallery

**hreflang Tags**: Automatically generated in `Layout.astro` for SEO.

All components receive `lang` and translate through `t()`.

### Styling – Tailwind CSS 4 + CSS-first effects

- `src/styles/global.css` is the single entry (imported in `Layout.astro`). It
  loads Tailwind through `@tailwindcss/vite` and defines the design system in
  `@theme`: brand colours (`gold`, `ink-*`, `fg-*`, `line*`), fonts, tracking
  and layout utilities (`container-page`, `container-wide`, `section-y`,
  `eyebrow`). The default Tailwind palette is disabled – use brand tokens only.
- `src/styles/effects.css` holds what utilities cannot express, written
  CSS-first (see the `css-first` skill): scroll-driven reveals, anchor-positioned
  popovers, `::details-content` accordion motion, `:has()`-driven state for the
  showcase and price list, gallery grid math, dialog `@starting-style`. State
  rules at the bottom are unlayered on purpose so they beat utilities.
- Shared UI lives in `src/components/ui/` (`Button`, `SectionHeader`,
  `ScaleFigure`). Use them instead of re-styling buttons or headings, so every
  section stays consistent.
- Interactive state prefers native HTML: radios + `:has()` (showcase, price
  sizes), `<details name>` (FAQ), `popover` (menu, language, tooltips),
  `<dialog>` (cookies, contact thanks).

### Themes

- Every colour token in `global.css` is a `light-dark()` pair; `color-scheme`
  picks the theme (system by default, `data-theme="light|dark"` on `<html>`
  when the visitor uses the toggle – stored in localStorage, applied before
  first paint). `scheme-dark` keeps the hero and showcase dark in both themes.
- Never hard-code colours in components; use the tokens.

### Price list layout

- The pricing panel is sized to the viewport (`min-h` = 100svh − nav), with
  `short:` / `tiny:` custom variants (global.css) tightening it on short
  screens. Phones get a scroll-snap carousel of the versions.
- The comparison table header is `position: sticky` under the nav.

### Agents, SEO, structured data

- `src/lib/site-data.ts` is the single source of machine-readable facts,
  covering both panel categories (stone and mineral; prices via `src/lib/prices.ts`,
  shared with the price list).
  It feeds JSON-LD (`lib/structured-data.ts` → Product/AggregateOffer,
  FAQPage, Store, ItemList), `/llms.txt`, `/agent/site.json`, the WebMCP
  tools (`components/agent/WebMcp.astro`) and the MCP server (`functions/mcp.ts`).
- WebMCP tools: get_price_list (stone + mineral prices), list_stone_patterns,
  list_mineral_patterns, search_faq, get_contact (read-only) and show_price_for_size, prefill_inquiry, open_page (UI only –
  agents never send the form). The contact form also carries declarative
  `toolname` attributes.
- `/mcp` is a stateless, read-only MCP server (Streamable HTTP, JSON-RPC).

### TypeScript

- `typescript-7` (npm alias of `typescript@7`) is the compiler used by
  `bun run typecheck` for `.ts` files.
- `typescript@6` stays installed for tooling that still needs the JS API
  (`@astrojs/check`, the Astro language server) until TypeScript 7.1 ships a
  stable API.

### Content & CMS

- Panel patterns: `src/data/products.json` – `items` (stone) and `mineral` (texture images for the mineral 3D/AR viewer; empty `title` → numbered "Minerální dekor N"). List order = order in the fan on the site (drag & drop in the CMS); the fan in `Products.astro` + `effects.css` fits any count and any screen width.
- Responsive images: `scripts/optimize-images.mjs` writes AVIF/WebP variants to `public/_img` + `src/data/image-manifest.json`; use `<Picture>` (`src/components/ui/Picture.astro`). Outputs are committed so builds only encode new images.
- Admin scripts in `public/admin/*.js` are loaded with `?v=YYYYMMDD` – bump it in `public/admin/index.html` after changing them.
- Stone vs mineral: `PanelCategorySwitch` sets `data-panel-category` on `<html>`; elements tagged `data-panel-type="stone|mineral"` show for one category only. Content that differs per category belongs in the data files above so the CMS can edit it.
- Gallery (`src/data/gallery-cms.json`, CMS → Galerie, rendered via `src/lib/gallery.ts`):
  - Photos and 360° panoramas are watermarked AVIF image sets in `public/media/<images|360>/<name>-<width>.avif`; entries store only the base path, `src/lib/image-set.ts` reads widths/sizes from the files.
  - One rule set, `src/lib/image-pipeline.ts` (widths, quality, watermark placement), is used by `scripts/image-set.ts` (Bun + sharp) and bundled into `public/admin/pipeline-core.js` (`bun run admin:build`, generated – don't edit) for the CMS worker (`public/admin/image-worker.js`).
  - CMS uploads: `media-upload.js` → `image-pipeline.js` (browser AVIF + watermark) → `repo-store.js` (GitHub Git Data API, `[skip ci]`). Videos still go to Cloudinary (`cloudinary-upload.js`, `functions/api/cloudinary.ts`).
  - Watermark artwork: `public/images/logos/watermark.svg` → `bun run watermark` renders `public/admin/watermark.png`.
- Price list: `src/data/prices.json` (prices per size, taglines, feature matrix, `mineralSurcharge` per size added for mineral panels).
- FAQ: `src/data/faq.json` (cs/en, `**bold**` rendered by `src/lib/inline-markdown.ts`; optional `answerMineral` and `hideInMineral` for the mineral panel view).
- All three are editable in **Decap CMS** at `/admin/` (`public/admin/config.yml`).
  GitHub OAuth runs through Cloudflare Pages Functions in `functions/api/`
  (see DEPLOY.md).

### Static Assets

- `public/3d/products/` - GLB 3D models for AR viewer
- `public/images/` - Backgrounds, gallery, product images (WebP format, multiple sizes)
- `public/downloads/` - PDF manuals and DAE 3D model downloads

### Key Dependencies

- `@google/model-viewer` and `three` - 3D/AR product visualization
- `@fancyapps/ui` - Image lightbox gallery
