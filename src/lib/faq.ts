/**
 * FAQ items for one language (src/data/faq.json, edited in the CMS).
 *
 * Each question has a shared answer and, optionally, a different answer for
 * mineral panels (`answerMineral`) or is hidden in the mineral view
 * (`hideInMineral`). An empty mineral answer – what the CMS saves for an
 * untouched optional field – falls back to the shared answer.
 */
import faq from "../data/faq.json";
import type { Lang } from "../i18n/utils";

interface FaqEntry {
  question: Record<Lang, string>;
  answer: Record<Lang, string>;
  answerMineral?: Partial<Record<Lang, string>>;
  hideInMineral?: boolean;
}

export interface FaqItem {
  question: string;
  /** Markdown subset (**bold**) – render with inlineMarkdown(). */
  answer: string;
  mineralAnswer: string;
  hideInMineral: boolean;
}

export function faqItems(lang: Lang, items: FaqEntry[] = faq.items as FaqEntry[]): FaqItem[] {
  return items.map((item) => ({
    question: item.question[lang],
    answer: item.answer[lang],
    mineralAnswer: item.answerMineral?.[lang]?.trim() || item.answer[lang],
    hideInMineral: item.hideInMineral === true,
  }));
}
