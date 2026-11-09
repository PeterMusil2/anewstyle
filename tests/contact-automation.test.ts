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
import {
  buildBusinessMail,
  buildCustomerMail,
  DEFAULT_MAIL_FROM,
  DEFAULT_MAIL_TO,
  formatExpiry,
} from "../src/lib/contact-emails";

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
    expect(component).toContain('selected={category === "unknown"}');
  });

  test("category, size and version are three custom selects that default to undecided", async () => {
    const component = await Bun.file("src/components/sections/Contact.astro").text();
    for (const name of ["panel_category_choice", "size", "version"]) {
      expect(component).toContain(`<select name="${name}"`);
    }
    // No radio group is left for these fields.
    expect(component).not.toContain('type="radio"');
    expect(component).toContain('<option value="" selected>');
    expect(component).toContain('selected={version === ""}');
    // Customizable-select hook plus the styling it needs.
    expect(component).toContain("<selectedcontent>");
    const css = await Bun.file("src/styles/effects.css").text();
    expect(css).toContain("appearance: base-select");
    expect(css).toContain(".select-field__control");
    expect(css).toContain("::picker-icon");
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

  test("retries an ambiguous upstream failure with the same submission ID", async () => {
    const originalFetch = globalThis.fetch;
    const submissionIds: string[] = [];
    let savedCode = "";
    globalThis.fetch = (async (_input, init) => {
      const payload = JSON.parse(String(init?.body)) as {
        code: string;
        expiresAt: string;
        submission: { submissionId: string };
      };
      submissionIds.push(payload.submission.submissionId);
      if (submissionIds.length === 1) {
        // Model Apps Script saving the row before the response connection drops.
        savedCode = payload.code;
        throw new TypeError("connection reset after write");
      }
      return new Response(JSON.stringify({
        success: true,
        recorded: true,
        code: savedCode,
        expiresAt: payload.expiresAt,
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
      expect(data.code).toBe(savedCode);
      expect(submissionIds).toHaveLength(2);
      expect(submissionIds[0]).toBe(submissionIds[1]);
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
    expect(script).toMatch(/setValue\("ODESÍLÁ SE"\);\s*SpreadsheetApp\.flush\(\);\s*try\s*\{\s*sendCustomerEmail\(/);
    expect(script).toMatch(/setValue\("ODESÍLÁ SE"\);\s*SpreadsheetApp\.flush\(\);\s*try\s*\{\s*sendBusinessEmail\(/);
    expect(script).toContain('emailState === "CHYBA – zkontrolovat"');
    expect(script).toContain('businessState === "CHYBA – zkontrolovat"');
  });

  test("sends the e-mails through Resend once a key is set, and tells Apps Script to stay quiet", async () => {
    const originalFetch = globalThis.fetch;
    const resendCalls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    let backendPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api.resend.com/")) {
        resendCalls.push({
          headers: init?.headers as Record<string, string>,
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return new Response('{"id":"x"}', { status: 200 });
      }
      backendPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        success: true,
        recorded: true,
        code: backendPayload.code,
        expiresAt: backendPayload.expiresAt,
        emailSent: false,
        businessNotified: false,
      }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    try {
      const response = await onRequestPost({
        request: createRequest(),
        env: {
          CONTACT_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/test-deployment/exec",
          CONTACT_SHEETS_SHARED_SECRET: "server-only-test-secret",
          RESEND_API_KEY: "re_test_key",
        },
      });
      const data = await response.json() as Record<string, unknown>;

      expect(data.success).toBe(true);
      expect(data.emailSent).toBe(true);
      expect(data.businessNotified).toBe(true);
      expect(backendPayload?.deliverMail).toBe(false);
      expect(resendCalls).toHaveLength(2);

      const customer = resendCalls.find((call) => (call.body.tags as { value: string }[])[1].value === "customer");
      const business = resendCalls.find((call) => (call.body.tags as { value: string }[])[1].value === "business");
      expect(customer?.body.to).toEqual(["eva@example.cz"]);
      expect(String(customer?.body.text)).toContain(String(data.code));
      expect(business?.body.to).toEqual(["anewstyle.brno@gmail.com"]);
      expect(business?.body.reply_to).toContain("eva@example.cz");
      expect(customer?.headers.Authorization).toBe("Bearer re_test_key");
      expect(customer?.headers["Idempotency-Key"]).toBe(`anewstyle-customer-${validSubmission().submission_id}`);
      expect(business?.headers["Idempotency-Key"]).toBe(`anewstyle-business-${validSubmission().submission_id}`);
      // Every mail carries the site tag so the Resend log can be filtered.
      for (const call of resendCalls) {
        expect((call.body.tags as { name: string; value: string }[])[0]).toEqual({ name: "site", value: "anewstyle" });
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("keeps the Gmail path without a Resend key and survives a failed Resend send", async () => {
    const originalFetch = globalThis.fetch;
    const env = {
      CONTACT_SHEETS_WEB_APP_URL: "https://script.google.com/macros/s/test-deployment/exec",
      CONTACT_SHEETS_SHARED_SECRET: "server-only-test-secret",
    };
    let resendCalled = false;
    let deliverMail: unknown;
    let resendStatus = 200;
    globalThis.fetch = (async (input, init) => {
      if (String(input).startsWith("https://api.resend.com/")) {
        resendCalled = true;
        return new Response("nope", { status: resendStatus });
      }
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      deliverMail = payload.deliverMail;
      return new Response(JSON.stringify({
        success: true,
        recorded: true,
        code: payload.code,
        expiresAt: payload.expiresAt,
        emailSent: true,
        businessNotified: true,
      }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    try {
      const withoutKey = await (await onRequestPost({ request: createRequest(), env })).json() as Record<string, unknown>;
      expect(deliverMail).toBe(true);
      expect(resendCalled).toBe(false);
      expect(withoutKey.emailSent).toBe(true);

      resendStatus = 500;
      const failed = await onRequestPost({ request: createRequest(), env: { ...env, RESEND_API_KEY: "re_test_key" } });
      const failedData = await failed.json() as Record<string, unknown>;
      // The inquiry is recorded, so the visitor still gets their code.
      expect(failed.status).toBe(200);
      expect(failedData.success).toBe(true);
      expect(failedData.code).toMatch(/^ANEW-[A-Z2-9]{8}$/);
      expect(failedData.emailSent).toBe(false);
      expect(failedData.businessNotified).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("e-mail templates escape visitor input and keep subjects on one line", () => {
    const parsed = parseContactSubmission({
      ...validSubmission(),
      name: 'Eva <script>alert(1)</script>\nBcc: x@y.cz',
      message: '<img src=x onerror=alert(1)>',
    });
    expect(parsed).not.toBeNull();
    const customer = buildCustomerMail(parsed!, "ANEW-AAAAAAAA", "2027-04-22", DEFAULT_MAIL_FROM);
    const business = buildBusinessMail(parsed!, "ANEW-AAAAAAAA", "2026-10-24T10:00:00.000Z", "2027-04-22", DEFAULT_MAIL_FROM, DEFAULT_MAIL_TO);
    expect(customer.html).not.toContain("<script>");
    expect(business.html).not.toContain("<img");
    expect(business.html).toContain("&#60;img");
    expect(business.subject).not.toMatch(/[\r\n]/);
    // Subjects name the site, so mails of ANEW STYLE and Vila SCALA never look alike in Resend.
    expect(business.subject.startsWith("Dotaz z webu ANEW STYLE — ")).toBe(true);
    expect(customer.subject).toBe("Děkujeme za zprávu — ANEW STYLE");
    expect(customer.text).toContain("22.04.2027");
    expect(formatExpiry("2027-04-22")).toBe("22.04.2027");
  });

  test("English visitors get the English code e-mail", () => {
    const parsed = parseContactSubmission({ ...validSubmission(), locale: "en" })!;
    const mail = buildCustomerMail(parsed, "ANEW-AAAAAAAA", "2027-04-22", DEFAULT_MAIL_FROM);
    expect(mail.subject).toBe("Thank you for your message — ANEW STYLE");
    expect(mail.text).toContain("valid until 22.04.2027");
  });

  test("Apps Script skips its own mail when the function sends through Resend", async () => {
    const script = await Bun.file("scripts/contact-automation/Code.gs").text();
    expect(script).toContain("body.deliverMail === false");
    expect(script).toContain('setValue("RESEND")');
    // The skip comes before any Gmail send.
    expect(script.indexOf("body.deliverMail === false")).toBeLessThan(script.indexOf("sendCustomerEmail(submission, body.code"));
  });

  test("mandatory fields are marked, validated inline and highlight on hover", async () => {
    const component = await Bun.file("src/components/sections/Contact.astro").text();
    const css = await Bun.file("src/styles/effects.css").text();
    const cs = JSON.parse(await Bun.file("src/i18n/cs.json").text());
    const en = JSON.parse(await Bun.file("src/i18n/en.json").text());

    // Name and e-mail carry a visible * plus a screen-reader "required"; the optional message does not.
    expect(component.match(/<span class="text-gold" aria-hidden="true">\*<\/span><span class="sr-only"> \(\{t\("contact\.formRequired"\)\}\)<\/span>/g)?.length).toBe(2);
    expect(component).toContain('{t("contact.formMessage")}');
    expect(component).not.toMatch(/formMessage"\)\}[^<]*\*/);

    // Inline messages live under the field and are wired to it for assistive tech.
    for (const field of ["fullname", "email"]) {
      expect(component).toContain(`aria-describedby="err-${field}"`);
      expect(component).toContain(`id="err-${field}" data-error-for="${field}" hidden`);
    }
    expect(component).toContain('data-err-fullname={t("contact.formErrName")}');
    expect(component).toContain('data-err-email={t("contact.formErrEmail")}');
    // Native bubbles are gone; the script validates on blur, live while invalid, and on submit.
    expect(component).not.toContain("reportValidity");
    expect(component).toContain("const validateField = (name: FieldName): boolean");
    expect(component).toContain('field.addEventListener("blur"');
    expect(component).toContain('if (field.getAttribute("aria-invalid") === "true") validateField(name);');
    expect(component).toContain("fieldNames.filter((name) => !validateField(name))");

    // Visual states: gold hover, red invalid (label too), green valid.
    expect(component.match(/hover:border-gold focus:border-gold/g)?.length).toBe(3);
    expect(component).toContain("aria-invalid:border-danger");
    expect(component).toContain("not-placeholder-shown:user-valid:border-success");
    expect(component).toContain("has-[[aria-invalid=true]]:text-danger");
    const control = css.slice(css.indexOf(".select-field__control {"));
    expect(control).toMatch(/&:hover \{\s*border-color: var\(--color-gold\);/);

    for (const lang of [cs, en]) {
      for (const key of ["contact.formRequired", "contact.formErrName", "contact.formErrEmail"]) {
        expect(String(lang[key]).length).toBeGreaterThan(3);
      }
    }
  });
});
