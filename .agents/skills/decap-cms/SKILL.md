---
name: decap-cms
description: The Decap CMS admin at /admin/ – config.yml collections (Galerie, Vzory panelů, Ceník, Časté dotazy), custom widgets, uploads, GitHub OAuth through Cloudflare Pages Functions, editors, editorial workflow and publish status, guided tours, local editing. Use for anything about the administration, the content model, a field that customers changed in code but cannot edit, login or upload problems.
---

# Decap CMS

## Pieces

| File | Role |
| --- | --- |
| `public/admin/index.html` | Decap from unpkg (pinned), our scripts with `?v=` cache-busting, login-page CSS fixes |
| `public/admin/config.yml` | GitHub backend `PeterMusil2/anewstyle`, branch `master`, `editorial_workflow`, Czech UI, collections |
| `gallery-manager.js` | `gallery-manager` widget – the whole gallery on one screen (filters, bonus, hide, crop focus, order) |
| `media-upload.js`, `image-pipeline.js`, `image-worker.js`, `pipeline-core.js`, `repo-store.js`, `vendor/` | Gallery photo/360° pipeline (see `image-pipeline`) |
| `cloudinary-upload.js`, `media-widgets.js` | Videos and the `media-image` / `media-file` fields (products) → Cloudinary via `functions/api/cloudinary.ts` |
| `admin-ux.js` | driver.js tours, "Nápověda", confirm-before-remove |
| `publish-status.js` | After "Publikovat" polls `/build.json` until the deployed commit changes |
| `functions/api/auth.ts`, `callback.ts` | GitHub OAuth |

## Content model

| Collection | File | Rendered by |
| --- | --- | --- |
| Galerie | `src/data/gallery-cms.json` | `src/lib/gallery.ts` → `Showroom.astro` |
| Vzory panelů | `src/data/products.json` (`items` stone, `mineral` textures) | `Products.astro`, `Card.astro`, `site-data.ts` |
| Ceník | `src/data/prices.json` (versions, features, `mineralSurcharge`) | `PriceList.astro`, `site-data.ts` |
| Časté dotazy | `src/data/faq.json` (`answer`, optional `answerMineral`, `hideInMineral`) | `Faq.astro`, `structured-data.ts`, `site-data.ts` |

UI texts are **not** in the CMS – they live in `src/i18n/cs.json` / `en.json` (see `i18n`).

Rules:
- Content that differs per panel category (stone / mineral) belongs in these JSON files, never hard-coded in a component – otherwise editors cannot change it.
- Adding a field: add it to the JSON with the current value, to `config.yml` (Czech label, a hint that says **where on the site** it shows, `required: false` for optional), to the TypeScript that reads it, and – if editors need to know – to the tour text in `admin-ux.js`.
- Optional objects come back as empty strings once an editor saves (`{ "cs": "", "en": "" }`) – code must fall back, not render blanks.
- Lists the site iterates must work for any length (the pattern fan, FAQ, gallery).
- Watch YAML: `: ` inside a plain hint starts a new key – write `3:4` or quote the string.

## Check a config change

1. `python3 -c "import yaml;yaml.safe_load(open('public/admin/config.yml'))"`.
2. `bun run dev` + `bun run cms:local` → `http://localhost:4321/admin/` → **full reload** (a hash change keeps the old config) → open each touched entry and confirm values load.
3. Build and compare the rendered HTML before/after if the data shape changed (output should be identical unless intended).

## GitHub OAuth and editors

- OAuth app callback `https://anewstyle.cz/api/callback`; Cloudflare Pages secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (type Secret). Login works on the production domain, not on `*.pages.dev`.
- Editors need **write** access to the repo (`gh api -X PUT repos/PeterMusil2/anewstyle/collaborators/<user>`; they accept the invitation).
- `CLOUDINARY_URL` (Secret) is needed by `/api/cloudinary` for video/product uploads; optional `DEPLOY_HOOK_URL`.

## Editorial workflow

Save = draft (PR on a `cms/…` branch, Cloudflare preview) → Ke kontrole / Připraveno → **Publikovat** merges to `master` → deploy in 2–3 min. Gallery files are already on `master` (`[skip ci]` commits) and go live with the publish.

## Troubleshooting

- Login button not clickable → logo pushed it under the Decap credit (fixed in `index.html` CSS); keep those rules.
- `/admin` 404 locally → the dev rewrite in `astro.config.mjs` (`adminIndexInDev`) must stay.
- Changes in admin JS not visible → bump `?v=`.
- Upload 401/403 → editor lacks write access; 400 "Folder not allowed" → add the folder to `ALLOWED_FOLDERS` in `functions/api/cloudinary.ts`.
