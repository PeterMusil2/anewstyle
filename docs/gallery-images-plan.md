# Plan: gallery photos + 360° in the repo, watermarked; videos stay on Cloudinary

Status: implemented (2026-10-22). Deviations from the plan below:

- Files live in `public/media/<images|360>/`, not `public/gallery/…`: `/gallery/`
  is the page URL, so a long `Cache-Control` on `/gallery/*` would have hit the
  page HTML. There's no gallery/bonus split in the path, because "Bonus" is a toggle on the item.
- No `build-gallery` step: `src/lib/gallery.ts` reads `gallery-cms.json` and
  the files directly, and video URLs are derived from the stored Cloudinary URL.
  The `cloudinary` npm package and the build-time `CLOUDINARY_URL` are gone.
- The shared module is `src/lib/image-pipeline.ts` (widths, quality, watermark),
  bundled to `public/admin/pipeline-core.js`.
- `Picture.astro` keeps its Cloudinary branch for product images.

Reference implementation:
[depthark/crystalinteriors.cz](https://github.com/depthark/crystalinteriors.cz)
(`public/admin/image-pipeline.js`, `image-worker.js`, `repo-store.js`,
`photo-upload.js`, `src/lib/image-set.ts`, `scripts/image-set.ts`).

## Goal

| Media | Today | After |
|---|---|---|
| Photos (82: 6 gallery + 76 bonus, 8 of them hidden) | Cloudinary, signed upload, `f_auto,q_auto` | AVIF image sets in `public/gallery/`, committed by the CMS, **watermark baked in** |
| 360° panoramas (5) | Cloudinary, `w_4096` | AVIF image sets in `public/gallery/`, watermark baked in |
| Videos (5) | Cloudinary | Cloudinary (unchanged: signed upload, `q_auto`, posters from Cloudinary) |

Repo: `PeterMusil2/anewstyle` on **GitHub** (public). Hosting: Cloudflare Pages.

## Cost: all free tiers

- **GitHub**: free repo, files are small (AVIF 5–300 KB each, panoramas ≤ ~2 MB).
  Estimated ~30–40 MB added (82 photos × ≤5 widths + 5 panoramas × 3 widths).
  Repo is ~150 MB today; GitHub's soft limit is 1 GB, hard file limit 100 MB.
- **Cloudflare Pages free**: 20 000 files per deploy and 25 MiB per file – ~450 new files is fine.
  Uploads commit with `[skip ci]`, so they use no builds out of the 500/month.
- **Compression + watermark run in the editor's browser** (WASM codecs, no server),
  so there is no paid image service and no Worker CPU cost.
  A Pages Function can't do this on the free plan (10 ms CPU limit, no `sharp`).
- **Cloudinary free plan**: only videos left on it, so credit use drops.

## Architecture

```
CMS (browser)                                           Build (Astro)
 photo/360 file ─► image-worker.js                       src/lib/image-set.ts
   decode (EXIF rotate) → watermark → resize Lanczos3     reads widths + size from
   → AVIF q55 per width → smartcrop focus                  the AVIF files on disk
 └─► repo-store.js → GitHub Git Data API                 ResponsiveImage / Picture
      one commit, [skip ci]                               → <img srcset sizes="auto">
 video file ─► /api/cloudinary sign → Cloudinary (as today)
```

Content stores only the base path `/gallery/<group>/<name>` (photo/360) or the
Cloudinary URL (video). Files: `public/gallery/<group>/<name>-<width>.avif`.

## Watermark

### Asset
- `public/images/logos/logo.svg` is an auto-traced raster: 365×850, black
  background box, 41 filled paths in grey/gold/white. It can't be turned into a
  stroke version automatically.
- Redraw it by hand as a clean SVG, `public/images/logos/watermark.svg`. The logo
  is pure geometry, so this is easy: an outer frame rectangle, the "A" diagonals
  and cross bars, one S curve, and "ANEW STYLE" rotated 90° (converted to paths,
  no font dependency).
- Style: stroke only, no background. White stroke (~2.5 % of logo width) with a
  thin black outline underneath (stroke drawn twice: black wider, white on top),
  so it reads on both light and dark photos. Group opacity ~0.30, to tune on real photos.

### Rasterised once, used everywhere
- `scripts/watermark.ts` renders `watermark.svg` → `public/admin/watermark.png`
  (transparent, ~1600 px tall, opacity already applied).
- One PNG feeds both the browser worker and the Bun bulk script, so their output
  is identical.
- Why PNG, not SVG at upload time: Chrome can't decode SVG with
  `createImageBitmap` inside a worker, and `sharp` and canvas rasterise SVG
  slightly differently.

### Placement (one shared module: `src/lib/watermark.ts`)
- Pure geometry, no I/O: `placeWatermark(imageW, imageH) → { x, y, w, h }`.
  - Centred.
  - Height = 40 % of the image height, width capped at 30 % of the image width.
  - Logo aspect ratio 0.43 is preserved.
- Applied **once at the original resolution, before downscaling**, so every
  width (400 → 1800) carries the same mark, just smaller.
- Browser: `OffscreenCanvas` `drawImage(watermarkBitmap, x, y, w, h)` on the
  decoded original.
- Bun: `sharp(...).composite([{ input: resizedPng, left: x, top: y }])`.
- `src/lib/watermark.ts` is imported directly by `scripts/image-set.ts`, and bundled
  into `public/admin/image-worker.js` by `bun build` (one source, so the TypeScript
  "service" the CMS and the script share).
- 360°: centred on the equirectangular image = straight ahead at the equator,
  where distortion is lowest. It's visible in the first view of the viewer.
  Optionally a smaller second copy at 180°.

### Consequence to accept
No original is stored anywhere (the repo is public, so storing originals would
defeat the watermark). Changing the watermark later means re-uploading from the
source files. Alternative: also keep originals in a private store (Cloudinary
private folder or R2 free 10 GB). That adds complexity, so it isn't in this plan by default.

## Scope: files

### New (ported 1:1 from Crystal Interiors, then adapted)
| File | Change vs Crystal Interiors |
|---|---|
| `public/admin/vendor/` (jsquash-avif, squoosh-resize, smartcrop) | as is |
| `public/admin/repo-store.js` | as is (reads repo/branch from `config.yml`) |
| `public/admin/image-pipeline.js` | + `kind: "photo" \| "360"` → width sets; loads `watermark.png` once and hands the bitmap to the worker |
| `public/admin/image-worker.js` | built from `src/admin/image-worker.ts`; + watermark step; panorama widths |
| `public/admin/photo-upload.js` | Czech messages kept; groups `gallery` / `bonus` × `images` / `360` |
| `src/lib/image-set.ts` | as is (`/gallery/...` sets, `ispe` box size read) |
| `src/lib/watermark.ts` | new, shared geometry |
| `scripts/image-set.ts` | + watermark composite, + panorama widths |
| `scripts/watermark.ts` | SVG → PNG |
| `scripts/migrate-gallery-to-repo.ts` | one-off, see Migration |
| `public/images/logos/watermark.svg`, `public/admin/watermark.png` | new assets |

Width sets:
- photo: `400, 800, 1200, 1800`, never upscaled (capped at 1800 after the migration came to 116 MB; Crystal Interiors goes to 2400).
- 360: `800` (tile), `2048` (phones), `4096` (= today's delivery cap).
  An 8K encode in browser WASM is slow (~1 min) and uses ~0.5 GB of memory, so it's left out.

### Changed
| File | Change |
|---|---|
| `public/admin/gallery-manager.js` | Photo/360 → `photo-upload.js` + `RepoStore`. Video → `AnewCloudinary` as today. Thumbnails: `-400.avif`, with a raw-GitHub fallback until deployed |
| `public/admin/cloudinary-upload.js` | `KINDS` → videos only |
| `functions/api/cloudinary.ts` | `ALLOWED_FOLDERS` → `*/videos` only; `rebuild` action kept |
| `public/admin/config.yml` | gallery `media` field accepts `/gallery/...` or a Cloudinary video URL; + `focus`, `width`, `height` fields (hidden) |
| `public/admin/index.html` | load new scripts, bump `?v=YYYYMMDD` |
| `scripts/build-cloudinary-gallery.mjs` → `scripts/build-gallery.ts` | CMS list stays the source of truth. Photos/360 resolved from disk via `image-set.ts`; videos still via the Cloudinary Admin API (5 items, fails soft). The folder scan of Cloudinary images is removed |
| `src/lib/cloudinary-gallery.ts` → `src/lib/gallery.ts` | item type gains `src` (image set) + `focus`; video keeps the URLs |
| `src/components/sections/Showroom.astro` | tiles via `ResponsiveImage` (`max=800`, `object-position` from focus instead of Cloudinary `g_auto` crop); lightbox `srcset ≥1200`; PSV gets the `-4096.avif` (or `-2048` on small screens) |
| `src/components/ui/Picture.astro` | remove the Cloudinary image branch, or merge `ResponsiveImage` into it |
| `public/_headers` | `/gallery/*` → `Cache-Control: public, max-age=31536000, stale-while-revalidate=86400` |
| `CLAUDE.md`, `DEPLOY.md`, `SETUP.md`, `.env.example` | document the new flow |

### Not in scope (decide separately)
- **Product images**: `imgLight/imgDark/imgFrame` still point the CMS media library
  at Cloudinary `AnewStyle/Products`, although `products.json` holds local
  `/images/products/*.webp`. They could move to the same pipeline, but whether
  products should carry the watermark is a separate decision.
- **3D `.glb` uploads**: stay as they are.

## Migration of existing media

`scripts/migrate-gallery-to-repo.ts`, run locally once with `CLOUDINARY_URL`:
1. For each `gallery-cms.json` entry that is an image:
   1. Download the **original** (`cloudinary.url(publicId, { type: "upload" })`, no transforms).
   2. `makeImageSet(buffer, "/gallery/<gallery|bonus>/<images|360>/<slug>", { kind, watermark: true })`.
   3. Rewrite `media` → base path, add `focus/width/height`.
2. Keep `alt`, `bonus`, `panorama`, `hidden` and the order.
3. Videos are left untouched.
4. Log a table of old URL → new path. Delete nothing in Cloudinary until the new gallery is live and checked.

Check first: whether any Cloudinary originals are already watermarked
(to avoid a double mark).

## Risks / notes

- **Bonus content is public** in both setups. Today the Cloudinary URLs ship in
  `public/data/gallery.json`. After the move, the files are also browsable in the
  public GitHub repo. The gate is UI-only either way. Only a private store plus a
  signed-URL Function would change that.
- **HEIC from iPhones** can't be decoded in Chrome/Firefox, so the editor is asked
  to export JPG (Crystal Interiors already shows this message).
- **Large panorama upload on a phone** may run out of memory. A Czech error message
  asks the editor to use a desktop.
- **Commits race with Decap**: `repo-store.js` already retries 3× when the branch head has moved.
- **Watermark crop on tiles**: tiles crop to 16:9 using the focus point, so a
  centred mark can sit off-centre or partly outside the tile. That's acceptable;
  the lightbox shows it in full.

## Steps (order)

1. Watermark: redraw `watermark.svg`, `scripts/watermark.ts` → PNG, tune opacity on 3–4 real photos.
2. `src/lib/watermark.ts` + `scripts/image-set.ts` (Bun, `sharp`) with tests on sample files.
3. Port the vendor codecs, `repo-store.js`, `image-pipeline.js`; build the worker from TS with the watermark.
4. CMS: `photo-upload.js`, `gallery-manager.js` split (photo/360 → repo, video → Cloudinary), `config.yml`, cache bust.
5. Build: `build-gallery.ts`, `lib/gallery.ts`, `Showroom.astro`, `Picture.astro`, `_headers`.
6. Migration script; run it; review the diff of `gallery-cms.json` + `public/gallery/`.
7. Verify:
   - `bun run build`.
   - Gallery filters, lightbox and PSV on desktop + phone.
   - CMS upload end to end with `cms:local`, then on the deployed admin (GitHub backend).
8. Docs; remove Cloudinary image folders only after sign-off.
