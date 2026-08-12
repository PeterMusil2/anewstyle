# Deployment — Cloudflare Pages

The site is a static Astro build deployed on **Cloudflare Pages** using
Cloudflare's built-in Git integration: every push to `master` triggers a build
on Cloudflare (no GitHub Actions involved).

- **Build command:** `bun run build`
- **Build output directory:** `dist`
- **Required build env var:** `CLOUDINARY_URL` (secret) — see below

## One-time Cloudflare setup

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorize GitHub and select the `PeterMusil/anewstyle` repository.
3. Configure the build:
   - **Production branch:** `master`
   - **Framework preset:** `Astro` (or `None` — the settings below win either way)
   - **Build command:** `bun run build`
   - **Build output directory:** `dist`
4. Add environment variables (Settings → Environment variables), for the
   **Production** environment (and **Preview** if you want preview deploys to
   pull fresh gallery data):
   - `CLOUDINARY_URL` = `cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>`
     — click **Encrypt** so it's stored as a secret.
   - Optional pins if a build ever picks the wrong runtime:
     - `BUN_VERSION` = `1.3.1`
     - `NODE_VERSION` = `22`
5. **Save and Deploy.** The first build runs immediately.

## Custom domain (anewstyle.cz)

Once a build succeeds on the `*.pages.dev` URL:

1. Pages project → **Custom domains** → **Set up a custom domain** → add
   `anewstyle.cz` (and `www.anewstyle.cz` if used).
2. Update DNS to the records Cloudflare shows. If the domain's DNS is already on
   Cloudflare this is automatic; otherwise point the records as instructed.
3. Remove the old GitHub Pages DNS/records once Cloudflare is serving.

## Getting `CLOUDINARY_URL`

`CLOUDINARY_URL` bundles the cloud name, API key and API secret in one string:

```
cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
```

To find it:

1. Sign in at <https://console.cloudinary.com>.
2. **Programmable Media → Dashboard**. The **Product Environment Credentials**
   panel lists `Cloud name`, `API Key` and `API Secret` (click to reveal the
   secret). Many dashboards show the ready-made `CLOUDINARY_URL=...` line — copy
   the part after `=`.
   - Alternatively: **Settings (gear) → API Keys** → reveal the secret and
     assemble the string yourself.
3. This is the **same account** the `AnewStyle/Gallery` folder lives in, so it is
   the same `CLOUDINARY_URL` used by the brand-design site.

> ⚠️ The API secret grants write access to the media library. Keep it out of the
> repo — it lives only in the Cloudflare Pages env var (encrypted) and, for local
> builds, in a git-ignored `.env` (see `.env.example`).

## Local build

```bash
echo 'CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD' > .env   # git-ignored
bun run build        # runs gallery:build → astro check → astro build
bun run preview      # serve dist/ locally
```

Without `CLOUDINARY_URL` the build still succeeds — the Cloudinary gallery just
renders empty (the loader fails soft), so previews and PRs don't need the secret.
