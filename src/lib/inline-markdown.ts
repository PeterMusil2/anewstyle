/**
 * Renders the tiny Markdown subset editors use in the CMS (**bold**) to HTML.
 * Everything else is escaped, so CMS content can never inject markup.
 */
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function inlineMarkdown(source: string): string {
  return source
    .replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
