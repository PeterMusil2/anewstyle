# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ANEW STYLE is a Czech product showcase website for illuminated stone panels (Rockfoil). Built with Astro 7 and Tailwind CSS 4, it features internationalization support (CS/EN) and 3D product visualization.

## Commands

```bash
bun run dev          # Astro dev server (http://localhost:4321)
bun run build        # gallery:build → typecheck → astro build → sitemap alias
bun run typecheck    # astro check (TypeScript 6 API) + tsc from TypeScript 7
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
- `ui.ts` - All translations as TypeScript objects with dotted keys (e.g., `nav.home`, `cookie.accept`)
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

### TypeScript

- `typescript-7` (npm alias of `typescript@7`) is the compiler used by
  `bun run typecheck` for `.ts` files.
- `typescript@6` stays installed for tooling that still needs the JS API
  (`@astrojs/check`, the Astro language server) until TypeScript 7.1 ships a
  stable API.

### Content & CMS

- Products: `src/content/products/*.md` (front matter).
- Price list: `src/data/prices.json` (prices per size, taglines, feature matrix).
- FAQ: `src/data/faq.json` (cs/en, `**bold**` rendered by `src/lib/inline-markdown.ts`).
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
