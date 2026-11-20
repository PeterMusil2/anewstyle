import data from "../data/advice.json";

export const articles = data.articles;
export const advicePath = "/poradna/";
export const articlePath = (slug: string) => `/${slug}/`;
export const isAdvicePath = (path: string) =>
  path === advicePath || articles.some(({ slug }) => path === articlePath(slug));
