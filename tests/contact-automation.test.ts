import { describe, expect, test } from "bun:test";
import { onRequestPost } from "../functions/api/contact";
import {
  DISCOUNT_CODE_PATTERN,
  DISCOUNT_POLICY,
  DISCOUNT_VALIDITY_DAYS,
  formatDiscountCode,
  getDiscountRate,
  getDiscountExpiry,
  parseContactSubmission,
} from "../src/lib/contact-automation";

const validSubmission = () => ({
  submission_id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Eva Nováková",
  email: "EVA@example.cz",
  message: "Prosím o informace k panelu.",
  panel_category: "mineral",
  locale: "cs",
  gclid: "test-gclid",
  fbclid: "",
  source: "google",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "mineral-panels",
  utm_content: "banner-a",
  utm_term: "svitici panel",
  landing_page: "https://anewstyle.cz/svitici-mineralni-panely/",
  referrer: "https://google.com/",
});

const createRequest = (body: unknown = validSubmission(), origin = "https://anewstyle.cz") =>
  new Request("https://anewstyle.cz/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });

describe("contact discount automation", () => {
  test("contact form offers the undecided panel category", async () => {
    const component = await Bun.file("src/components/sections/Contact.astro").text();
    expect(component).toContain('["stone", "mineral", "unknown"]');
    expect(component).toContain('"contact.formUnknown"');
    expect(component).toContain('checked={category === "unknown"}');
  });

  test("normalizes a valid inquiry and keeps advertising attribution", () => {
    const parsed = parseContactSubmission(validSubmission());
    expect(parsed).not.toBeNull();
    expect(parsed?.email).toBe("eva@example.cz");
    expect(parsed?.panelCategory).toBe("mineral");
    expect(parsed?.attribution.gclid).toBe("test-gclid");
    expect(parsed?.attribution.utm_campaign).toBe("mineral-panels");
    expect(parseContactSubmission({ ...validSubmission(), panel_category: "unknown" })?.panelCategory).toBe("unknown");
  });

  test("rejects malformed, unsupported, and honeypot submissions", () => {
    expect(parseContactSubmission({ ...validSubmission(), email: "not-an-email" })).toBeNull();
    expect(parseContactSubmission({ ...validSubmission(), panel_category: "other" })).toBeNull();
    expect(parseContactSubmission({ ...validSubmission(), botcheck: "filled-by-bot" })).toBeNull();
    expect(parseContactSubmission({ ...validSubmission(), message: "x".repeat(4_001) })).toBeNull();
    expect(parseContactSubmission({ ...validSubmission(), submission_id: "not-a-uuid" })).toBeNull();
  });

  test("creates readable codes from secure random bytes", () => {
    const code = formatDiscountCode(new Uint8Array(8).fill(0));
    expect(code).toBe("ANEW-AAAAAAAA");
    expect(code).toMatch(/^ANEW-[A-Z2-9]{8}$/);
    expect(code).not.toMatch(/[IO01]/);
    expect(DISCOUNT_CODE_PATTERN.test(code)).toBe(true);
    expect(DISCOUNT_CODE_PATTERN.test("AS-AAAAA-AAAAA")).toBe(true);
    expect(DISCOUNT_CODE_PATTERN.test("ANEW-AAAAAAA")).toBe(false);
    expect(() => formatDiscountCode(new Uint8Array(7))).toThrow();
  });

  test("sets expiry exactly 180 days after issue", () => {
    expect(DISCOUNT_VALIDITY_DAYS).toBe(180);
    expect(getDiscountExpiry(new Date("2026-10-24T00:00:00.000Z"))).toBe("2027-04-22");
    expect(getDiscountExpiry(new Date("2026-10-23T22:30:00.000Z"))).toBe("2027-04-22");
    expect(DISCOUNT_POLICY).toBe("SLIM 5 %; BASIC a DELUXE 7 %");
    expect(() => getDiscountExpiry(new Date("invalid"))).toThrow();
  });

  test("stores a numeric discount rate for the selected version", () => {
    expect(getDiscountRate("SLIM")).toBe(0.05);
    expect(getDiscountRate("BASIC")).toBe(0.07);
    expect(getDiscountRate("DELUXE")).toBe(0.07);
    expect(getDiscountRate("")).toBeNull();
  });

  test("returns a generated code only after the private register confirms the write", async () => {
    const originalFetch = globalThis.fetch;
    let backendPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (_input, init) => {
      backendPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        success: true,
        recorded: true,
        code: backendPayload.code,
        expiresAt: backendPayload.expiresAt,
        emailSent: true,
        businessNotified: true,
      }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    try {
      const response = await onRequestPost({
        request: createRequest(),
        env: {
          CONTACT_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/test-deployment/exec",
          CONTACT_SHEETS_SHARED_SECRET: "server-only-test-secret",
        },
      });
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.code).toMatch(/^ANEW-[A-Z2-9]{8}$/);
      expect(data.emailSent).toBe(true);
      expect(backendPayload?.secret).toBe("server-only-test-secret");
      expect(JSON.stringify(validSubmission())).not.toContain("server-only-test-secret");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not reveal a code if logging fails and rejects cross-origin calls", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, error: "write_failed" }), {
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

    try {
      const response = await onRequestPost({
        request: createRequest(),
        env: {
          CONTACT_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/test-deployment/exec",
          CONTACT_SHEETS_SHARED_SECRET: "server-only-test-secret",
        },
      });
      const data = await response.json() as Record<string, unknown>;
      expect(response.status).toBe(502);
      expect(data.code).toBeUndefined();

      const crossOrigin = await onRequestPost({
        request: createRequest(validSubmission(), "https://example.com"),
        env: {},
      });
      expect(crossOrigin.status).toBe(403);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Apps Script stores inquiries idempotently and sends code plus lead notification", async () => {
    const script = await Bun.file("scripts/contact-automation/Code.gs").text();
    expect(script).toContain("findSubmissionRow(sheet, submission.submissionId)");
    expect(script).toContain('sheet.appendRow(record)');
    expect(script).toContain('"Velikost panelu"');
    expect(script).toContain('"Provedení"');
    expect(script).toContain('submission.panelCategory === "unknown"');
    expect(script).toContain('return "Zatím nevím"');
    expect(script).toContain("discountRateForVersion(submission.version)");
    expect(script).toContain("const DISCOUNT_CODE_PATTERN = /^(?:ANEW-[A-Z2-9]{8}|AS-[A-Z2-9]{5}-[A-Z2-9]{5})$/;");
    expect(script).toContain('sheet.getRange(rowNumber, 5).setNumberFormat("0%")');
    expect(script).toContain("sendCustomerEmail(submission, body.code, body.expiresAt)");
    expect(script).toContain("sendBusinessEmail(submission, body.code");
    expect(script).toContain('sheet.getRange(rowNumber, 27).setValue("ODESLÁNO")');
    expect(script).toContain('sheet.getRange(rowNumber, 28).setValue("ODESLÁNO")');
    expect(script).toMatch(/setValue\("ODESÍLÁ SE"\)[\s\S]*sendCustomerEmail\(/);
    expect(script).toMatch(/setValue\("ODESÍLÁ SE"\)[\s\S]*sendBusinessEmail\(/);
    expect(script).toContain('emailState === "CHYBA – zkontrolovat"');
    expect(script).toContain('businessState === "CHYBA – zkontrolovat"');
  });
});
