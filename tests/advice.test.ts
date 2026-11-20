import { expect, test } from "bun:test";
import { articles, articlePath, isAdvicePath } from "../src/lib/advice";

test("the three Czech guides have independent routes and public editorial content", () => {
  expect(new Set(articles.map(({ slug }) => slug)).size).toBe(3);
  for (const article of articles) {
    expect(isAdvicePath(articlePath(article.slug))).toBe(true);
    expect(article.body).not.toMatch(/^## (?:Návrh interních odkazů|Poznámky pro publikaci|Ověřené zdroje)/m);
    expect(Bun.file("public" + article.image).size).toBeGreaterThan(0);
    expect(Bun.file("public" + article.cardImage).size).toBeGreaterThan(0);
  }
});
