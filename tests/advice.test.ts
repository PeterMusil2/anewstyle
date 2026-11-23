import { illustrateAdvice } from "../src/lib/advice-illustrations";
import { expect, test } from "bun:test";
import { articles, articlePath, isAdvicePath } from "../src/lib/advice";
import { getSiteData } from "../src/lib/site-data";

test("the three Czech guides have independent routes and public editorial content", () => {
  expect(new Set(articles.map(({ slug }) => slug)).size).toBe(3);
  for (const article of articles) {
    expect(isAdvicePath(articlePath(article.slug))).toBe(true);
    expect(article.body).not.toMatch(/^## (?:Návrh interních odkazů|Poznámky pro publikaci|Ověřené zdroje)/m);
    expect(article.seoTitle).toMatch(/\| AnewStyle$/);
    expect(article.author).toBe("AnewStyle / OSM s.r.o.");
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(article.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(article.imageAlt.trim().length).toBeGreaterThan(20);
    expect(Bun.file("public" + article.image).size).toBeGreaterThan(0);
    expect(Bun.file("public" + article.cardImage).size).toBeGreaterThan(0);
  }
});

test("the published guides contain the approved technical facts and internal links", () => {
  const bySlug = Object.fromEntries(articles.map((article) => [article.slug, article]));
  const technology = bySlug["jak-funguje-svitici-panel"]!.body;
  const comparison = bySlug["slim-basic-deluxe"]!.body;
  const mounting = bySlug["montaz-sviticiho-kamenneho-panelu"]!.body;

  expect(technology).toContain("velikosti XL maximální spotřebu 84 W a u XXL 110 W");
  expect(technology).toContain("](/slim-basic-deluxe/)");
  expect(technology).toContain("](/montaz-sviticiho-kamenneho-panelu/)");

  for (const body of [comparison, mounting]) {
    expect(body).toContain("| L | 15 kg | 25 kg |");
    expect(body).toContain("| XL | 23 kg | 36 kg |");
    expect(body).toContain("| XXL | 30 kg | 47 kg |");
    expect(body).toContain("| XXXL | 45 kg | 72 kg |");
    expect(body).toContain("±5 %");
  }
  expect(comparison).toContain("](/jak-funguje-svitici-panel/)");
  expect(comparison).toContain("](/montaz-sviticiho-kamenneho-panelu/)");
  expect(mounting).toContain("](/jak-funguje-svitici-panel/)");
  expect(mounting).toContain("](/slim-basic-deluxe/)");
  expect(mounting).toContain("/images/poradna/montazni-sada-antracit.webp");
  expect(mounting).toContain("/images/poradna/anewstyle-montaz-slim.webp");
  expect(mounting).not.toContain("/images/poradna/AnewStyle_montazni_sada_SLIM_02_1200.webp");
  expect(mounting).not.toContain("/images/poradna/04_schema_montaze_SLIM_1200.webp");
  expect(technology).toContain("/images/poradna/03_princip_lite_PMMA_LGP_1200.webp");
});

test("article schema carries dates, publisher and complete video metadata", async () => {
  const page = await Bun.file("src/pages/[advice].astro").text();
  const layout = await Bun.file("src/layouts/Layout.astro").text();

  for (const key of ["datePublished", "dateModified", "publisher", "uploadDate", "duration", "transcript"]) {
    expect(page).toContain(key);
  }
  expect(page).toContain('duration: "PT25.76S"');
  expect(page).toContain('uploadDate: "2026-11-20"');
  expect(page).toContain("article.seoTitle");
  expect(page).toContain("article.imageAlt");
  expect(layout).toContain('<meta name="author" content={author} />');
});

test("agent data exposes the public guides from the same CMS source", () => {
  const site = getSiteData("cs");
  expect(site.guides).toHaveLength(3);
  expect(site.guides.find((guide) => guide.slug === "slim-basic-deluxe")?.bodyMarkdown).toContain("| XXXL | 45 kg | 72 kg |");
  expect(site.guides.every((guide) => guide.url.startsWith("https://anewstyle.cz/"))).toBe(true);
  for (const article of articles) {
    const guide = site.guides.find((item) => item.slug === article.slug);
    expect(guide?.bodyMarkdown).toBe(article.body);
    expect(guide?.image).toBe(`https://anewstyle.cz${article.image}`);
    expect(guide?.visuals[0]).toEqual({
      role: "hero",
      url: `https://anewstyle.cz${article.image}`,
      alt: article.imageAlt,
    });
    expect(guide?.visuals.every((visual) => visual.url.startsWith("https://anewstyle.cz/images/"))).toBe(true);
  }
  const mounting = site.guides.find((guide) => guide.slug === "montaz-sviticiho-kamenneho-panelu");
  expect(mounting?.visuals.map((visual) => visual.url)).toContain("https://anewstyle.cz/images/poradna/montazni-sada-antracit.webp");
  expect(mounting?.visuals.map((visual) => visual.url)).toContain("https://anewstyle.cz/images/poradna/anewstyle-montaz-slim.webp");
});

test("mounting kit keeps its component list in the figure caption", () => {
  const result = illustrateAdvice('<p><img src="/images/poradna/montazni-sada-antracit.webp" alt="Montážní sada"></p><ul><li>L profil</li></ul>');
  expect(result).toContain("<figcaption><ul><li>L profil</li></ul></figcaption>");
});
