---
name: cloudflare-deploy
description: Deploy and run anewstyle.cz on Cloudflare Pages – push to master, build settings, secrets (GitHub OAuth, Cloudinary, deploy hook), [skip ci] commits, preview deploys of CMS drafts, /build.json, headers and redirects, custom domain and DNS without touching e-mail, rollback. Use for hosting, domains, DNS, deploys, "nasadit web" or a failed build.
---

# Cloudflare Pages

**Ground rules**: deploys, DNS and Cloudflare settings affect production – confirm with the user first. Never type secrets (the user enters them in the dashboard). Never change MX/SPF or other mail records of `anewstyle.cz`.

## Project

- Pages project `anewstyle`, Git integration with `PeterMusil2/anewstyle`, production branch **`master`**, build `bun run build`, output `dist` (`wrangler.toml`).
- Every push to `master` deploys (2–3 min); CMS drafts (`cms/…` branches) get preview deploys.
- Commits whose message contains `[skip ci]` are **not built** (CMS photo uploads). If a needed commit got skipped, push an empty commit.
- `/build.json` shows the deployed commit (`CF_PAGES_COMMIT_SHA`); the CMS publish panel polls it.
- Functions: `functions/api/auth.ts`, `callback.ts` (CMS login), `functions/api/cloudinary.ts` (signed uploads), `functions/mcp.ts` (read-only MCP).

## Secrets (Settings → Variables and Secrets, type **Secret**)

`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `CLOUDINARY_URL`, optional `DEPLOY_HOOK_URL`. Optional pins `NODE_VERSION`, `BUN_VERSION`. The build itself needs no secrets.

## Headers and caching

`public/_headers`: security headers, `noindex` on `*.pages.dev`, cache rules (`/_astro/*`, `/media/*` immutable; images a month; `/admin/*` no-cache). A rule on a path prefix also hits pages with that prefix – never put a long cache on a page route (e.g. `/gallery/*` would cache the gallery HTML).

## Deploy check (after every push to master)

```bash
git rev-parse HEAD
curl -s https://anewstyle.cz/build.json        # commit must match once the build is done
curl -sI https://anewstyle.cz/ | head -5
```

Then smoke-test on the live site: `/`, `/en/`, `/gallery/`, `/admin/` (login page loads), one 3D viewer, one panorama. A failed build: Cloudflare dashboard → Deployments → the build log; reproduce locally with `bun run build`.

## Domain and DNS

`anewstyle.cz` is attached to the Pages project. Before any DNS change write a snapshot of every record (NS, A/AAAA, CNAME, MX, SPF/TXT, DKIM, DMARC) to `docs/ROLLBACK.md`. Mail records stay DNS-only and unchanged. SSL Full (strict), Always Use HTTPS; no Rocket Loader / injected scripts without asking.

## Rollback

Cloudflare → Deployments → an earlier production deployment → "Rollback to this deployment"; then fix forward with a commit (`git revert`).
