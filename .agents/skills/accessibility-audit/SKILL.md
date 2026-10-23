---
name: accessibility-audit
description: Audit and fix accessibility (WCAG 2.2 AA) on anewstyle.cz – contrast in light and dark theme (including always-dark scheme-dark sections), keyboard and focus, the stone/mineral switch, popovers and dialogs, the gallery lightbox and 3D/panorama viewers, forms, motion, 320 px width without horizontal scroll. Use for "a11y", "accessibility", "přístupnost", contrast failures, or before a release.
---

# Accessibility audit (WCAG 2.2 AA)

Target: Lighthouse Accessibility 100 **and** a manual pass – tools catch about a third of real issues.

## Automated

- Lighthouse (CLI or DevTools MCP `lighthouse_audit`) on `/`, `/gallery/`, `/en/`, mobile and desktop, **light and dark theme** (emulate `prefers-color-scheme` or set `data-theme`), and with the **mineral** category selected.
- Optional: `npx @axe-core/cli <url>`.

## Manual checklist

**Contrast** – text ≥ 4.5:1, large text and UI borders/icons ≥ 3:1. Tokens are `light-dark()` pairs in `src/styles/global.css`; fix lightness there, never per component. `scheme-dark` sections (hero, showcase) stay dark in both themes – check gold text and white overlays on the worst photo/video frame.

**Keyboard** – Tab through every page: logical order, the skip link first (`#main`), visible `:focus-visible` everywhere, no traps.
- Popovers (menu, language, tooltips) and `<dialog>`s (cookies, contact thanks, mineral 3D viewer) open with Enter, close with Escape, return focus.
- Stone/mineral switch (`PanelCategorySwitch`, radio inputs) and the price-size radios are operable with arrow keys; the selected state is not colour-only.
- Pattern fan cards, gallery tiles, Fancybox and the panorama viewer work by keyboard; focus returns to the tile.
- FAQ: native `<details name>`.

**Structure** – one `<h1>`; headings don't skip levels; landmarks (`header`, `nav` with label, `main#main`, `footer`); `<html lang>` cs/en; sections `aria-labelledby`.

**Images and media** – meaningful alt (cs + en) for content images, `alt=""` for decorative ones; the hero video has a pause control and no sound; 3D viewers have an `alt`.

**Forms** (contact, Web3Forms) – visible labels, required marked and explained, inline errors tied with `aria-describedby`, status in a live region, `autocomplete` tokens.

**Motion** – `prefers-reduced-motion` disables reveals, fan transitions and smooth scrolling.

**Touch / zoom** – targets ≥ 44 × 44 px; works at 200 % zoom and **320 px width without horizontal scroll** (check `document.documentElement.scrollWidth === innerWidth`).

## Report

Per page: scores (light/dark, mobile/desktop, stone/mineral), issues by WCAG criterion, fix (file:line), anything that needs the client (alt texts).
