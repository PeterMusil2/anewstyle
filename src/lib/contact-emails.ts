import { DISCOUNT_POLICY, type ContactSubmission } from "./contact-automation";

/**
 * Resend e-mails for the contact form. The text mirrors what the Apps Script
 * (`scripts/contact-automation/Code.gs`) sends through Gmail, so switching the
 * transport does not change what customers or the team receive.
 */

export const DEFAULT_MAIL_FROM = "ANEW STYLE <web@anewstyle.cz>";
export const DEFAULT_MAIL_TO = "anewstyle.brno@gmail.com";

/** Tags show on every e-mail in the Resend dashboard, so sites and kinds can be filtered. */
export const MAIL_SITE_TAG = { name: "site", value: "anewstyle" } as const;

export type MailKind = "customer" | "business";

export type OutgoingMail = {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
  html: string;
  tags: { name: string; value: string }[];
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/** One line only, so a pasted newline can never end up in a subject. */
const oneLine = (value: string): string => value.replace(/[\r\n\t]+/g, " ").trim();

export const panelCategoryLabel = (category: ContactSubmission["panelCategory"]): string =>
  category === "stone"
    ? "Svítící kamenné panely"
    : category === "mineral"
      ? "Svítící minerální panely"
      : "Zatím nevím";

/** `2026-11-09` → `09.11.2026`; anything else is returned untouched. */
export const formatExpiry = (isoDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : isoDate;
};

export function buildCustomerMail(
  submission: ContactSubmission,
  code: string,
  expiresAt: string,
  from: string,
): OutgoingMail {
  const english = submission.locale === "en";
  const name = oneLine(submission.name);
  const expiry = formatExpiry(expiresAt);

  // Same pattern as the Vila SCALA auto-reply ("Děkujeme za zprávu — <site>"), so the two sites
  // sharing one Resend team are easy to tell apart. The discount code is in the body.
  const subject = english ? "Thank you for your message — ANEW STYLE" : "Děkujeme za zprávu — ANEW STYLE";
  const text = english
    ? `Hello ${name},\n\nthank you for your inquiry. Your personal discount code is ${code}. It is valid until ${expiry} and can be used once: 5% for SLIM or 7% for BASIC and DELUXE. Mention it when requesting a quote or during a consultation.\n\nANEW STYLE`
    : `Dobrý den ${name},\n\nděkujeme za vaši poptávku. Váš osobní slevový kód je ${code}. Platí do ${expiry} a lze jej uplatnit jednou: 5 % pro SLIM nebo 7 % pro BASIC a DELUXE. Uveďte jej při poptávce nebo konzultaci.\n\nANEW STYLE`;
  const html = english
    ? `<p>Hello ${escapeHtml(name)},</p><p>thank you for your inquiry. Your personal discount code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${escapeHtml(code)}</p><p>It is valid until ${escapeHtml(expiry)} and can be used once: 5% for SLIM or 7% for BASIC and DELUXE. Mention it when requesting a quote or during a consultation.</p><p>ANEW STYLE</p>`
    : `<p>Dobrý den ${escapeHtml(name)},</p><p>děkujeme za vaši poptávku. Váš osobní slevový kód je:</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${escapeHtml(code)}</p><p>Platí do ${escapeHtml(expiry)} a lze jej uplatnit jednou: 5 % pro SLIM nebo 7 % pro BASIC a DELUXE. Uveďte jej při poptávce nebo konzultaci.</p><p>ANEW STYLE</p>`;

  return {
    from,
    to: [submission.email],
    subject,
    text,
    html,
    tags: [MAIL_SITE_TAG, { name: "type", value: "customer" }],
  };
}

export function buildBusinessMail(
  submission: ContactSubmission,
  code: string,
  issuedAt: string,
  expiresAt: string,
  from: string,
  to: string,
): OutgoingMail {
  const { attribution } = submission;
  const name = oneLine(submission.name);
  const rows: [string, string][] = [
    ["Jméno", name],
    ["E-mail", submission.email],
    ["Telefon", submission.phone || "Neuveden"],
    ["Kategorie", panelCategoryLabel(submission.panelCategory)],
    ["Velikost panelu", submission.size || "Neuvedena"],
    ["Provedení", submission.version || "Neuvedeno"],
    ["Slevový kód", code],
    ["Sleva", DISCOUNT_POLICY],
    ["Vydáno", issuedAt],
    ["Platnost do", expiresAt],
    ["ID odeslání", submission.submissionId],
  ];
  const attributionRows: [string, string][] = [
    ["GCLID", attribution.gclid],
    ["FBCLID", attribution.fbclid],
    ["Zdroj", attribution.source],
    ["UTM source", attribution.utm_source],
    ["UTM medium", attribution.utm_medium],
    ["UTM campaign", attribution.utm_campaign],
    ["UTM content", attribution.utm_content],
    ["UTM term", attribution.utm_term],
    ["Vstupní stránka", attribution.landing_page],
    ["Referrer", attribution.referrer],
  ];
  const message = submission.message || "(Bez doplňující zprávy)";

  const text = [
    "Nová poptávka z webu ANEW STYLE",
    ...rows.map(([key, value]) => `${key}: ${value}`),
    "",
    "Poptávka:",
    message,
    "",
    ...attributionRows.map(([key, value]) => `${key}: ${value}`),
  ].join("\n");

  const table = (list: [string, string][]): string =>
    `<table style="border-collapse:collapse">${list
      .map(
        ([key, value]) =>
          `<tr><td style="padding:2px 16px 2px 0;color:#666">${escapeHtml(key)}</td><td style="padding:2px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
      )
      .join("")}</table>`;

  const html = `<h2 style="margin:0 0 12px">Nová poptávka z webu ANEW STYLE</h2>${table(rows)}<p style="margin:16px 0 4px;color:#666">Poptávka:</p><div style="white-space:pre-wrap;border-left:3px solid #a38c52;padding:6px 14px;background:#f6f4ef">${escapeHtml(message)}</div><p style="margin:16px 0 4px;color:#666">Marketing:</p>${table(attributionRows)}`;

  return {
    from,
    to: [to],
    reply_to: `${name.replace(/[<>",]/g, "")} <${submission.email}>`,
    subject: `Dotaz z webu ANEW STYLE — ${name}`,
    text,
    html,
    tags: [MAIL_SITE_TAG, { name: "type", value: "business" }],
  };
}

/**
 * Send one e-mail through Resend. The idempotency key (the form submission ID
 * plus the kind of mail) means a retried submission never sends it twice.
 */
export async function sendViaResend(
  apiKey: string,
  mail: OutgoingMail,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mail),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error("Resend rejected the e-mail.", response.status, await response.text().catch(() => ""));
    }
    return response.ok;
  } catch (error) {
    console.error("Resend request failed.", error);
    return false;
  }
}
