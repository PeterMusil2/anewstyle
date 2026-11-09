import {
  buildBusinessMail,
  buildCustomerMail,
  DEFAULT_MAIL_FROM,
  DEFAULT_MAIL_TO,
  sendViaResend,
} from "../../src/lib/contact-emails";
import {
  DISCOUNT_CODE_PATTERN,
  DISCOUNT_POLICY,
  formatDiscountCode,
  getDiscountExpiry,
  parseContactSubmission,
} from "../../src/lib/contact-automation";

interface Env {
  CONTACT_SHEETS_WEB_APP_URL?: string;
  CONTACT_SHEETS_SHARED_SECRET?: string;
  /** Resend API key. While it is unset, Apps Script keeps sending the e-mails through Gmail. */
  RESEND_API_KEY?: string;
  /** Who receives the inquiry notification (default: the ANEW STYLE Gmail account). */
  CONTACT_TO?: string;
  /** Sender shown to visitors; the domain must be verified in Resend. */
  CONTACT_FROM?: string;
}

interface Context {
  request: Request;
  env: Env;
}

interface AutomationResult {
  success?: boolean;
  recorded?: boolean;
  code?: string;
  expiresAt?: string;
  emailSent?: boolean;
  businessNotified?: boolean;
  error?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

function getAutomationUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "script.google.com" ||
      !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) {
    return json({ success: false }, 403);
  }

  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    return json({ success: false }, 415);
  }

  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 12_000) return json({ success: false }, 413);

  let rawBody: unknown;
  try {
    const rawText = await request.text();
    if (new TextEncoder().encode(rawText).byteLength > 12_000) {
      return json({ success: false }, 413);
    }
    rawBody = JSON.parse(rawText);
  } catch {
    return json({ success: false }, 400);
  }

  const submission = parseContactSubmission(rawBody);
  if (!submission) return json({ success: false }, 400);

  const automationUrl = getAutomationUrl(env.CONTACT_SHEETS_WEB_APP_URL);
  const sharedSecret = env.CONTACT_SHEETS_SHARED_SECRET?.trim();
  if (!automationUrl || !sharedSecret) return json({ success: false }, 503);

  const resendKey = env.RESEND_API_KEY?.trim();
  const issuedAt = new Date();
  const expiresAt = getDiscountExpiry(issuedAt);
  const basePayload = {
    secret: sharedSecret,
    submission,
    discountPolicy: DISCOUNT_POLICY,
    issuedAt: issuedAt.toISOString(),
    expiresAt,
    // With a Resend key the function sends the e-mails itself; Apps Script then
    // only records the inquiry. Without one it sends them through Gmail as before.
    deliverMail: !resendKey,
  };

  let result: AutomationResult | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = formatDiscountCode(crypto.getRandomValues(new Uint8Array(8)));
    try {
      const response = await fetch(automationUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, code }),
        signal: AbortSignal.timeout(20_000),
      });
      const parsed = (await response.json()) as AutomationResult;
      if (response.ok && parsed.success && parsed.recorded) {
        result = parsed;
        break;
      }
      if (parsed.error === "code_collision") continue;
      if (
        attempt < 2 &&
        (response.status >= 500 || parsed.error === "busy" || parsed.error === "processing_failed")
      ) {
        await retryDelay(attempt);
        continue;
      }
      return json({ success: false }, 502);
    } catch {
      if (attempt === 2) return json({ success: false }, 502);
      await retryDelay(attempt);
    }
  }

  if (!result?.success || !result.recorded || !result.code || !DISCOUNT_CODE_PATTERN.test(result.code)) {
    return json({ success: false }, 502);
  }

  const finalExpiry = result.expiresAt ?? expiresAt;
  let emailSent = result.emailSent === true;
  let businessNotified = result.businessNotified === true;

  if (resendKey) {
    const from = env.CONTACT_FROM?.trim() || DEFAULT_MAIL_FROM;
    const to = env.CONTACT_TO?.trim() || DEFAULT_MAIL_TO;
    // The inquiry is already recorded; a failed e-mail must not fail the request.
    [emailSent, businessNotified] = await Promise.all([
      sendViaResend(
        resendKey,
        buildCustomerMail(submission, result.code, finalExpiry, from),
        `anewstyle-customer-${submission.submissionId}`,
      ),
      sendViaResend(
        resendKey,
        buildBusinessMail(submission, result.code, issuedAt.toISOString(), finalExpiry, from, to),
        `anewstyle-business-${submission.submissionId}`,
      ),
    ]);
  }

  return json({
    success: true,
    code: result.code,
    expiresAt: finalExpiry,
    emailSent,
    businessNotified,
  });
};

function retryDelay(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
}
