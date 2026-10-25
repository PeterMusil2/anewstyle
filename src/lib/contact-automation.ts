export type PanelCategory = "stone" | "mineral";
export type ContactLocale = "cs" | "en";
export type PanelSize = "" | "L" | "XL" | "XXL" | "XXXL";
export type PanelVersion = "" | "SLIM" | "BASIC" | "DELUXE";

export const DISCOUNT_POLICY = "SLIM 5 %; BASIC a DELUXE 7 %";
export const DISCOUNT_VALIDITY_DAYS = 180;

export const ATTRIBUTION_FIELDS = [
  "gclid",
  "fbclid",
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "landing_page",
  "referrer",
] as const;

export type ContactSubmission = {
  submissionId: string;
  name: string;
  email: string;
  message: string;
  size: PanelSize;
  version: PanelVersion;
  panelCategory: PanelCategory;
  locale: ContactLocale;
  attribution: Record<(typeof ATTRIBUTION_FIELDS)[number], string>;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const boundedText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) return null;
  return normalized;
};

/** Validate and normalize untrusted contact-form JSON before it reaches storage. */
export function parseContactSubmission(input: unknown): ContactSubmission | null {
  const body = asRecord(input);
  if (!body) return null;

  const submissionId = boundedText(body.submission_id, 36);
  const name = boundedText(body.name, 120);
  const email = boundedText(body.email, 254)?.toLowerCase() ?? null;
  const message = boundedText(body.message ?? "", 4_000);
  const size = boundedText(body.size ?? "", 4);
  const version = boundedText(body.version ?? "", 6);
  const panelCategory = body.panel_category;
  const locale = body.locale;

  if (!submissionId || !SUBMISSION_ID_PATTERN.test(submissionId)) return null;
  if (!name || !email || message === null || size === null || version === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  if (name.length < 2) return null;
  if (size !== "" && !["L", "XL", "XXL", "XXXL"].includes(size)) return null;
  if (version !== "" && !["SLIM", "BASIC", "DELUXE"].includes(version)) return null;
  if (panelCategory !== "stone" && panelCategory !== "mineral") return null;
  if (locale !== "cs" && locale !== "en") return null;
  if (body.botcheck !== undefined && body.botcheck !== "" && body.botcheck !== false) return null;

  const attribution = {} as ContactSubmission["attribution"];
  for (const field of ATTRIBUTION_FIELDS) {
    const value = boundedText(body[field] ?? "", 1_000);
    if (value === null) return null;
    attribution[field] = value;
  }

  return { submissionId, name, email, message, size: size as PanelSize, version: version as PanelVersion, panelCategory, locale, attribution };
}

/** Format ten random bytes as a readable code with 50 bits of entropy. */
export function formatDiscountCode(randomBytes: Uint8Array): string {
  if (randomBytes.length !== 10) {
    throw new Error("A discount code requires exactly 10 random bytes.");
  }

  const token = Array.from(randomBytes, (byte) => CODE_ALPHABET[byte & 31]).join("");
  return `AS-${token.slice(0, 5)}-${token.slice(5)}`;
}

/** Return the YYYY-MM-DD date 180 days after issue, independent of host locale. */
export function getDiscountExpiry(issuedAt: Date): string {
  if (!Number.isFinite(issuedAt.getTime())) throw new Error("Invalid issue date.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(issuedAt);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((item) => item.type === type)?.value);
  const pragueDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  pragueDate.setUTCDate(pragueDate.getUTCDate() + DISCOUNT_VALIDITY_DAYS);
  return pragueDate.toISOString().slice(0, 10);
}
