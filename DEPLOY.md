# Deployment — Cloudflare Pages

The site is a static Astro build deployed to **Cloudflare Pages**. Every push to
`master` triggers a build (`bun run build`) and Cloudflare serves `dist/`. The
custom domain `anewstyle.cz` points at the Pages project.

- **Repository:** `PeterMusil2/anewstyle`
- **Build command:** `bun run build`
- **Build output directory:** `dist` (also declared in `wrangler.toml`)
- **Production branch:** `master`
- **Required build secret:** `CLOUDINARY_URL` — without it the build still
  succeeds, the Cloudinary gallery just renders empty.

## One-time Cloudflare setup

1. Sign in at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorize GitHub and select the `PeterMusil2/anewstyle` repository.
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
3. Remove the old GitHub Pages A/AAAA records once Cloudflare is serving.

`astro.config.mjs` sets `site: "https://anewstyle.cz/"`, which drives the sitemap
and canonical URLs — it needs no change for Cloudflare.

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

## Decap CMS (`/admin/`)

The CMS edits products, the price list and the FAQ and commits to this
repository (editorial workflow: every change is a pull request, so Cloudflare
builds a preview before it is published).

GitHub sign-in needs a small OAuth server – it runs as Cloudflare Pages
Functions in `functions/api/auth.ts` and `functions/api/callback.ts`.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Homepage URL: `https://anewstyle.cz`
   - Authorization callback URL: `https://anewstyle.cz/api/callback`
2. Copy the **Client ID** and generate a **Client secret**.
3. Cloudflare Pages project → **Settings → Variables and Secrets**
   (Production):
   - `GITHUB_CLIENT_ID` = client ID
   - `GITHUB_CLIENT_SECRET` = client secret (**Encrypt**)
4. Redeploy. Editors with write access to `PeterMusil2/anewstyle` can now sign
   in at `https://anewstyle.cz/admin/`.

Local editing without GitHub: run `bun run dev` and `bun run cms:local` side by
side and open `http://localhost:4321/admin/` – changes are written straight to
the working copy.

## Agent endpoints

Nothing to configure – they deploy with the site:

- `/llms.txt` – Markdown summary (prices, FAQ, contact) for LLMs.
- `/agent/site.json` – the same facts as JSON (cs + en).
- `/mcp` – read-only MCP server (Cloudflare Pages Function). Test:
  `curl -s https://anewstyle.cz/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
