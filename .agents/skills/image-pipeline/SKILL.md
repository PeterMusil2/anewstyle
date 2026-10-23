---
name: image-pipeline
description: Work with images on anewstyle.cz – the three image paths (site images via optimize-images + <Picture>, gallery photos/360° as watermarked AVIF image sets in public/media, videos and product files on Cloudinary), CMS uploads, the watermark, bulk import, srcset/sizes, the lightbox and the panorama viewer. Use whenever images, the gallery, uploads, the watermark or image performance are involved.
---

# Image pipeline

## Three paths – pick the right one

| What | Where it lives | How it is made | Rendered by |
| --- | --- | --- | --- |
| Site images (hero, showcase, products, patterns, technologies, before/after) | `public/images/**` originals → `public/_img/**-<w>.avif/.webp` + `src/data/image-manifest.json` | `bun run images` (`scripts/optimize-images.mjs`, part of `bun run build`; folders in `FOLDERS`) | `<Picture src="/images/…" sizes>` (`src/components/ui/Picture.astro`) – AVIF + WebP srcsets |
| Gallery photos and 360° panoramas | `public/media/<images\|360>/<name>-<width>.avif` | CMS upload (browser) or `bun run gallery:image` – **watermarked** | `src/lib/gallery.ts` → `Showroom.astro` (tiles, Fancybox, Photo Sphere Viewer) |
| Gallery videos, product photos/3D uploaded in the CMS | Cloudinary (cloud `lukaschylik`, `AnewStyle/…`) | CMS → `/api/cloudinary` signs → browser uploads | Video URLs derived in `gallery.ts`; Cloudinary image URLs get a srcset in `Picture.astro` |

**Watermark only on gallery photos and 360°.** Product photos, mineral textures and site images never get one.

## Gallery image sets (`public/media/`)

- One photo = AVIF files in fixed widths, never upscaled; a standard width is skipped when the original is within 18 % of it. Photos `400, 800, 1200, 1800`; panoramas `800, 2048, 4096` (2:1 equirectangular, checked on upload).
- One rule set: `src/lib/image-pipeline.ts` (widths, AVIF quality 55, watermark placement). It is used by `scripts/image-set.ts` (Bun + sharp) and bundled into `public/admin/pipeline-core.js` by `bun run admin:build` (generated – never edit).
- Watermark: art in `public/images/logos/watermark.svg` (opacity is the root `opacity`) → `bun run watermark` renders `public/admin/watermark.png`. It is drawn once on the full-size image, centred (photos 40 % of the height, max 30 % of the width; panoramas 18 % of the height), before resizing. Preview on real photos: `bun scripts/watermark.ts preview <out-dir> <file-or-url>… [--360 <file-or-url>…]`.
- Content (`src/data/gallery-cms.json`) stores only the base path `/media/<images|360>/<name>` plus `alt {cs,en}`, `bonus`, `panorama`, `hidden`, `focus {x,y}`, `width`, `height`. `src/lib/image-set.ts` reads widths and size from the files at build time.
- Tiles: 16:9 (portrait 9:16), `focus` → `object-position`, srcset up to 1800 (panoramas 2048), `sizes="auto, …"`. Lightbox: Fancybox `data-srcset` ≥ 1200. Panorama viewer: the largest file.
- `/media/*` is cached for a year as immutable – every upload gets a random suffix, never overwrite a file in place.

## CMS uploads

- **Galerie** → "Nahrát fotky / videa" (`public/admin/media-upload.js`): Photo / 360° → `image-pipeline.js` + `image-worker.js` (decode with EXIF orientation, clean preview for smartcrop focus, watermark, Lanczos3 resize, Squoosh AVIF in module workers) → `repo-store.js` commits all files in **one** commit through the GitHub Git Data API with the editor's CMS token, message ends with `[skip ci]` (Cloudflare does not build it). The gallery JSON then goes through the editorial workflow.
- Video → Cloudinary (`cloudinary-upload.js`, folders `AnewStyle/<Gallery|Bonus>/videos`).
- Locally (`bun run cms:local`) files are written to the working copy through `decap-server`.
- Removing an item in the CMS leaves its files in the repo (recoverable).

## Bulk import (agent)

```bash
bun run gallery:image ./photo.jpg /media/images/<name>          # photo
bun run gallery:image ./pano.jpg /media/360/<name> 360           # panorama
```

Prints `{ src, width, height, widths, focus }` – add an entry to `src/data/gallery-cms.json`. For many files import `makeImageSet` from `scripts/image-set.ts` (see `scripts/migrate-gallery-to-repo.ts`).

## Rules

- Every `<img>` has width/height; content images need real alt text (cs + en).
- Don't commit originals for gallery photos (the repo is public – originals would defeat the watermark).
- `bun run build` re-encodes some `public/_img` files and reorders `image-manifest.json`; restore them (`git checkout -- public/_img src/data/image-manifest.json`) unless you added or changed a site image.
- After changing `public/admin/*.js` bump `?v=` in `public/admin/index.html`.
