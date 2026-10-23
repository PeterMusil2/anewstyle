---
name: update-dependencies
description: Bring anewstyle.cz to the latest stable packages, Bun, Node.js LTS and pinned CDN scripts (Decap, driver.js), then verify build, tests, CMS and Lighthouse. Use for periodic upkeep or when the user asks to update dependencies.
---

# Update dependencies

## 1. Find current versions (never from memory)

- Node.js LTS: `curl -s https://nodejs.org/dist/index.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const l=d.find(r=>r.lts);console.log(l.version,l.lts)'`
- Bun: `curl -s https://api.github.com/repos/oven-sh/bun/releases/latest | grep tag_name`
- Packages: `bun outdated`.
- Majors (Astro, Tailwind, TypeScript, Decap, model-viewer, three, Photo Sphere Viewer, Fancybox): read the release notes / migration guide first (context7 or the changelog).

## 2. Update

```bash
bun upgrade
bun update --latest
bun install
```

Sync every pin:

| What | Where |
| --- | --- |
| Node LTS | `.node-version`, `package.json → engines.node`, Cloudflare env `NODE_VERSION`, `@types/node` major = LTS major |
| Bun | Cloudflare env `BUN_VERSION` |
| Decap CMS | `public/admin/index.html` (`decap-cms@x.y.z` on unpkg) |
| driver.js | `public/admin/admin-ux.js` (jsDelivr URL) |
| Vendored codecs | `public/admin/vendor/` (jSquash AVIF, Squoosh resize, smartcrop) – only on purpose, keep the single-thread `threads` stub, test an upload |

## Deliberate holds (re-check each time)

- `typescript` 6 stays next to `typescript-7` (`npm:typescript@^7`) because `@astrojs/check` needs the TS 6 API. When it supports TS 7, drop the alias and use plain `tsc`.
- `@types/node` follows the Node LTS major.
- `smartcrop-sharp` should match the vendored browser smartcrop so CMS and CLI focus points agree.

## 3. Verify (the validation steps in `AGENTS.md`)

```bash
bun run build        # admin:build → images → typecheck → astro build – 0 errors
bun test             # all tests green
bun run preview      # /, /en/, /gallery/, 3D viewer, panorama, lightbox
```

- CMS (`bun run dev` + `bun run cms:local` → `/admin/`): entries load, a test gallery upload produces watermarked AVIF files (delete them afterwards).
- `performance-audit` Lighthouse numbers not worse than before.
- Restore build noise in `public/_img` and `image-manifest.json` if no site image changed.

## 4. Commit

`chore(deps): update to latest (Astro x, Tailwind y, Bun z, Node LTS n)` – list majors and required code changes.
