---
name: performance-audit
description: Measure and fix Core Web Vitals and Lighthouse performance on anewstyle.cz – LCP (hero video/poster), CLS, TBT, images, the 3D viewer, the gallery, GTM and other third parties. Use for "performance", "web vitals", "Lighthouse", "page speed", slow pages, or after adding images, video, 3D or scripts.
---

# Performance audit

Target: Lighthouse 95–100 in every category on `/`, `/gallery/` and their `/en/` versions, mobile and desktop; CLS ≤ 0.01, TBT ≈ 0. New work must not regress the numbers measured before it.

## Measure

1. Production output only: `bun run build && bun run preview` – or better the deployed URL (Cloudflare adds Brotli/HTTP3). Dev-server numbers are meaningless.
2. Lighthouse CLI (mobile by default, add `--preset=desktop`):
   ```bash
   npx -y lighthouse@12 https://anewstyle.cz/ --quiet --chrome-flags="--headless=new" --output=json --output-path=lh.json
   node -e 'const r=require("./lh.json"),a=r.audits;console.log(Object.values(r.categories).map(c=>c.id+"="+Math.round(c.score*100)).join(" "),"LCP",a["largest-contentful-paint"].displayValue,"CLS",a["cumulative-layout-shift"].displayValue,"TBT",a["total-blocking-time"].displayValue)'
   ```
   Run each page twice if a score looks off (variance ±2).
3. Chrome DevTools MCP (if available): `performance_start_trace` with reload → `performance_analyze_insight` for the LCP breakdown, render-blocking requests and layout-shift culprits.
4. Keep before/after numbers in the report.

## What the site already does (keep it)

- **Inlined CSS** (`build.inlineStylesheets: "always"`), system font stack (no web-font downloads).
- **Responsive images**: `<Picture>` serves AVIF + WebP srcsets from `public/_img`; gallery tiles get `sizes="auto"` and never more than 1800 px; the lightbox ≥ 1200 px only on open; panoramas load the large file only in the viewer.
- **Heavy features load on intent**: `@google/model-viewer` / three.js on the first 3D/AR click, Photo Sphere Viewer on the first panorama, Fancybox JS + CSS on the first hover/focus/touch of a gallery item.
- **GTM** loads deferred (`Layout.astro`); Cloudinary is preconnected only on pages that use it.
- **Caching** (`public/_headers`): `/_astro/*` immutable, `/media/*` one year immutable, other static media a month + SWR, HTML revalidates. Service worker (`public/sw.js`) caches pages network-first and images stale-while-revalidate.
- Every image has width/height; reveals animate only `transform`/`opacity`.

## Typical fixes

| Symptom | Fix |
| --- | --- |
| Large image transfer | correct `sizes`, cap the srcset (`max` widths), add the folder to `FOLDERS` in `optimize-images.mjs` so it gets variants |
| LCP late on mobile | the LCP element must be eager + `fetchpriority="high"`, everything else lazy |
| CLS | missing width/height or aspect-ratio on a media box; content injected above the fold |
| TBT | a script runs on load – defer it to idle or first interaction |
| Horizontal scroll on phones | an element wider than the viewport (e.g. a rotated fan) – fix the layout, keep `overflow-x: clip` only as a safety net |

## Report

Table per page (mobile/desktop): perf / a11y / best practices / SEO, LCP, CLS, TBT; what changed; anything left with its cause.
