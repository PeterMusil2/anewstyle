import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

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
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["import", "legacy-js-api"],
        },
      },
    },
  },
});
