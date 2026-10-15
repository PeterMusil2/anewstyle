import {
  ui,
  defaultLang,
  languages,
  type Lang,
  type TranslationKey,
} from "./i18n";

/**
 * Get the language from URL pathname
 */
export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in languages) {
    return lang as Lang;
  }
  return defaultLang;
}

/**
 * Get translations for a specific language
 */
export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return ui[lang][key] ?? ui[defaultLang][key] ?? key;
  };
}

/**
 * Normalize an HTML page pathname to the canonical trailing-slash form.
 * Static assets keep their file-extension URLs unchanged.
 */
function normalizePagePath(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (
    normalizedPath === "/" ||
    normalizedPath.endsWith("/") ||
    /\/[^/]+\.[^/]+$/.test(normalizedPath)
  ) {
    return normalizedPath;
  }

  return `${normalizedPath}/`;
}

/**
 * Build a canonical URL without query parameters or fragments.
 */
export function getCanonicalUrl(currentUrl: URL, site: URL): URL {
  return new URL(normalizePagePath(currentUrl.pathname), site);
}

/**
 * Get the path for switching to a different language
 */
export function getLanguageSwitchPath(
  currentUrl: URL,
  targetLang: Lang
): string {
  const pathname = currentUrl.pathname;

  // Remove current language prefix if exists
  const pathWithoutLang = pathname.replace(/^\/(cs|en)(\/|$)/, "/");

  // Add new language prefix (or none for default)
  if (targetLang === defaultLang) {
    return `${normalizePagePath(pathWithoutLang || "/")}${
      currentUrl.search
    }${currentUrl.hash}`;
  }

  return `${normalizePagePath(`/${targetLang}${pathWithoutLang}`)}${
    currentUrl.search
  }${currentUrl.hash}`;
}

/**
 * Get alternate language links for hreflang tags
 */
export function getAlternateLinks(
  currentUrl: URL
): { lang: Lang; href: string }[] {
  const baseUrl = currentUrl.origin;
  const pathname = normalizePagePath(currentUrl.pathname);

  // Remove current language prefix if exists
  const pathWithoutLang = pathname.replace(/^\/(cs|en)(\/|$)/, "/");

  return (Object.keys(languages) as Lang[]).map((lang) => {
    const localizedPath = normalizePagePath(
      lang === defaultLang ? pathWithoutLang : `/${lang}${pathWithoutLang}`
    );

    return {
      lang,
      href: `${baseUrl}${localizedPath}`,
    };
  });
}

export const getLangShortLabel = (lang: Lang): string => {
  const labels: Record<Lang, string> = {
    cs: "CZ",
    en: "EN",
  };

  return labels[lang];
};

export { defaultLang, type Lang, type TranslationKey };
