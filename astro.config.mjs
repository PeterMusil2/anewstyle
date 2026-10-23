import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const site = "https://anewstyle.cz/";
const manualPdfUrls = {
  cs: new URL(
    "/downloads/Manual_CZ_AnewStyle_Basic_Deluxe.pdf",
    site
  ).href,
  en: new URL(
    "/downloads/Manual_EN_AnewStyle_Basic_Deluxe.pdf",
    site
  ).href,
};
const panelPageAlternates = {
  "/svitici-kamenne-panely/": {
    cs: new URL("/svitici-kamenne-panely/", site).href,
    en: new URL("/en/illuminated-stone-panels/", site).href,
  },
  "/en/illuminated-stone-panels/": {
    cs: new URL("/svitici-kamenne-panely/", site).href,
    en: new URL("/en/illuminated-stone-panels/", site).href,
  },
  "/svitici-mineralni-panely/": {
    cs: new URL("/svitici-mineralni-panely/", site).href,
    en: new URL("/en/illuminated-mineral-panels/", site).href,
  },
  "/en/illuminated-mineral-panels/": {
    cs: new URL("/svitici-mineralni-panely/", site).href,
    en: new URL("/en/illuminated-mineral-panels/", site).href,
  },
};

// Cloudflare Pages serves public/admin/index.html at /admin/, but the Astro
// dev server only serves public files by their exact path. Rewrite the folder
// URL in dev so the CMS opens at /admin/ locally too (`bun run cms:local`).
const adminIndexInDev = {
  name: "admin-index-in-dev",
  apply: "serve",
  configureServer(server) {
    const handle = (req, res, next) => {
      const url = req.url ?? "";
      if (/^\/admin(?:[?#]|$)/.test(url)) {
        // Like Cloudflare: /admin → /admin/ (Astro's trailing-slash check would 404 it).
        res.statusCode = 301;
        res.setHeader("Location", url.replace(/^\/admin/, "/admin/"));
        return res.end();
      }
      if (/^\/admin\/(?:[?#]|$)/.test(url)) {
        req.url = url.replace(/^\/admin\//, "/admin/index.html");
      }
      next();
    };
    // Astro puts its trailing-slash check at the front of the stack in its
    // post hook; this post hook runs after it, so /admin is handled first.
    return () => server.middlewares.stack.unshift({ route: "", handle });
  },
};

// https://astro.build/config
export default defineConfig({
  allowImportingTsExtensions: true,
  site,
  base: "/",
  trailingSlash: "always",
  i18n: {
    locales: ["cs", "en"],
    defaultLocale: "cs",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [
    sitemap({
      customPages: Object.values(manualPdfUrls),
      i18n: {
        defaultLocale: "cs",
        locales: {
          cs: "cs",
          en: "en",
        },
      },
      serialize(item) {
        const itemPath = new URL(item.url).pathname;
        const panelAlternate = panelPageAlternates[itemPath];
        if (panelAlternate) {
          return {
            ...item,
            links: [
              { lang: "cs", url: panelAlternate.cs },
              { lang: "en", url: panelAlternate.en },
              { lang: "x-default", url: panelAlternate.cs },
            ],
          };
        }

        if (Object.values(manualPdfUrls).includes(item.url)) {
          return {
            ...item,
            links: [
              { lang: "cs", url: manualPdfUrls.cs },
              { lang: "en", url: manualPdfUrls.en },
              { lang: "x-default", url: manualPdfUrls.cs },
            ],
          };
        }

        const links = item.links ?? [];
        const defaultLink = links.find(({ lang }) => lang === "cs");

        if (!defaultLink || links.some(({ lang }) => lang === "x-default")) {
          return item;
        }

        return {
          ...item,
          links: [
            ...links,
            { lang: "x-default", url: defaultLink.url },
          ],
        };
      },
    }),
  ],
  // One small stylesheet: inline it to save a render-blocking request (FCP).
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [tailwindcss(), adminIndexInDev],
  },
});
