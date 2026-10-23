---
name: i18n
description: Czech/English on anewstyle.cz – Astro i18n routing (cs default without prefix, en under /en/), UI strings in src/i18n/cs.json + en.json with typed keys, bilingual CMS content ({cs, en} objects), hreflang/canonical/sitemap per locale, the language switcher. Use when adding or changing any visible text, a page, or a translation.
---

# Czech and English

## How it works here

- Routing: `astro.config.mjs → i18n` – `defaultLocale: "cs"` without prefix, `en` under `/en/`. Pages are mirrored: `src/pages/*.astro` and `src/pages/en/*.astro`.
- UI strings: `src/i18n/cs.json` and `en.json` (flat dotted keys, e.g. `products.mineralIntro`), loaded by `src/i18n/i18n.ts`; components call `useTranslations(lang)` → `t(key)` (`src/i18n/utils.ts`). Missing keys fall back to Czech, then to the key itself.
- CMS content is bilingual inside the JSON: `{ "cs": "…", "en": "…" }` objects (FAQ, taglines, gallery alt). Proper names (pattern titles like PINK) are not translated.
- hreflang + `x-default` (cs) in `Layout.astro`; the sitemap integration emits i18n alternates; `LangSwitch` links to the same page in the other language.

## Rules

- Every visible string goes through `t()` or a `{cs, en}` content object – never a literal in a component.
- A new key is added to **both** `cs.json` and `en.json` in the same change (a test checks the key sets match).
- Texts editors should change belong in a CMS-edited JSON file (see `decap-cms`); UI micro-copy can stay in the i18n files.
- `**bold**` inside strings is rendered by `src/lib/inline-markdown.ts` only where the component uses it.
- New page: add it under both `src/pages/` and `src/pages/en/`, give it `meta.title*`/`meta.description*` keys, and check hreflang pairs.

## Check

- `/` and `/en/` (and every new page) render with no key names showing (`grep -o 'products\.[a-zA-Z]*' dist/index.html` should find nothing visible).
- No mixed-language sections, including the mineral variants.
- `seo-audit` per locale.
