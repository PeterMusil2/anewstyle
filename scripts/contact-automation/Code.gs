const SHEET_NAME = "Kódy";
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;
const BUSINESS_EMAIL = "info@anewstyle.cz";
const SECRET_PROPERTY = "CONTACT_SHARED_SECRET";
const SPREADSHEET_ID_PROPERTY = "SPREADSHEET_ID";
const DISCOUNT_CODE_PATTERN = /^(?:ANEW-[A-Z2-9]{8}|AS-[A-Z2-9]{5}-[A-Z2-9]{5})$/;
const EXPECTED_ADDITIONAL_HEADERS = [
  "Jméno zákazníka",
  "Text poptávky",
  "Kategorie panelu",
  "GCLID",
  "FBCLID",
  "Zdroj",
  "UTM source",
  "UTM medium",
  "UTM campaign",
  "UTM content",
  "UTM term",
  "Vstupní stránka",
  "Referrer",
  "ID odeslání formuláře",
  "Stav e-mailu zákazníkovi",
  "Stav oznámení firmy",
  "Velikost panelu",
  "Provedení",
];

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(event && event.postData ? event.postData.contents : "{}");
    const configuredSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY) || "";
    if (!constantTimeEqual(String(body.secret || ""), configuredSecret)) {
      return output({ success: false, error: "unauthorized" });
    }

    const submission = body.submission;
    if (!isValidRequest(body, submission)) {
      return output({ success: false, error: "invalid_request" });
    }
    if (!lock.tryLock(30000)) {
      return output({ success: false, error: "busy" });
    }

    try {
      const spreadsheetId = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY) || "";
      if (!spreadsheetId) throw new Error("Missing spreadsheet ID in script properties.");
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error("Missing target sheet.");
      ensureHeaders(sheet);

      const existingRow = findSubmissionRow(sheet, submission.submissionId);
      if (existingRow) {
        const existing = sheet.getRange(existingRow, 1, 1, 30).getValues()[0];
        if (String(existing[1]).trim().toLowerCase() !== submission.email.toLowerCase()) {
          return output({ success: false, error: "id_conflict" });
        }
        if (!existing[28] && submission.size) sheet.getRange(existingRow, 29).setValue(safeCell(submission.size));
        if (!existing[29] && submission.version) sheet.getRange(existingRow, 30).setValue(safeCell(submission.version));
        const discountRate = discountRateForVersion(submission.version);
        if (discountRate !== "") sheet.getRange(existingRow, 5).setValue(discountRate);
        const mailState = String(existing[26] || "");
        const businessState = String(existing[27] || "");
        const savedBody = Object.assign({}, body, {
          code: String(existing[0]),
          expiresAt: formatDate(existing[5], "yyyy-MM-dd", sheet),
        });
        const delivery = deliverMessages(sheet, existingRow, savedBody, mailState, businessState);
        return output({
          success: true,
          recorded: true,
          code: String(existing[0]),
          expiresAt: savedBody.expiresAt,
          emailSent: delivery.emailSent,
          businessNotified: delivery.businessNotified,
        });
      }

      const issueDate = new Date(body.issuedAt);
      const expiryDate = new Date(String(body.expiresAt) + "T12:00:00Z");
      if (findCodeRow(sheet, body.code)) {
        return output({ success: false, error: "code_collision" });
      }

      const record = [
        body.code,
        safeCell(submission.email),
        issueDate,
        "",
        discountRateForVersion(submission.version),
        expiryDate,
        "Aktivní",
        "",
        "",
        "",
        "",
        "",
        safeCell(submission.name),
        safeCell(submission.message),
        panelCategoryLabel(submission.panelCategory),
        safeCell(submission.attribution.gclid),
        safeCell(submission.attribution.fbclid),
        safeCell(submission.attribution.source),
        safeCell(submission.attribution.utm_source),
        safeCell(submission.attribution.utm_medium),
        safeCell(submission.attribution.utm_campaign),
        safeCell(submission.attribution.utm_content),
        safeCell(submission.attribution.utm_term),
        safeCell(submission.attribution.landing_page),
        safeCell(submission.attribution.referrer),
        submission.submissionId,
        "Čeká",
        "Čeká",
        safeCell(submission.size),
        safeCell(submission.version),
      ];
      sheet.appendRow(record);
      const rowNumber = sheet.getLastRow();
      sheet.getRange(FIRST_DATA_ROW, 1, 1, 30).copyTo(
        sheet.getRange(rowNumber, 1, 1, 30),
        { formatOnly: true }
      );
      sheet.getRange(rowNumber, 3).setNumberFormat("dd.mm.yyyy hh:mm");
      sheet.getRange(rowNumber, 5).setNumberFormat("0%");
      sheet.getRange(rowNumber, 6).setNumberFormat("dd.mm.yyyy");

      const delivery = deliverMessages(sheet, rowNumber, body, "", "");
      return output({
        success: true,
        recorded: true,
        code: body.code,
        expiresAt: body.expiresAt,
        emailSent: delivery.emailSent,
        businessNotified: delivery.businessNotified,
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return output({ success: false, error: "processing_failed" });
  }
}

function isValidRequest(body, submission) {
  return Boolean(
    submission &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(submission.submissionId || "")) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(submission.email || "")) &&
      String(submission.name || "").length <= 120 &&
      String(submission.message || "").length <= 4000 &&
      ["", "L", "XL", "XXL", "XXXL"].indexOf(String(submission.size || "")) >= 0 &&
      ["", "SLIM", "BASIC", "DELUXE"].indexOf(String(submission.version || "")) >= 0 &&
      (submission.panelCategory === "stone" || submission.panelCategory === "mineral" || submission.panelCategory === "unknown") &&
      (submission.locale === "cs" || submission.locale === "en") &&
      DISCOUNT_CODE_PATTERN.test(String(body.code || "")) &&
      body.discountPolicy === "SLIM 5 %; BASIC a DELUXE 7 %" &&
      !Number.isNaN(new Date(body.issuedAt).getTime()) &&
      !Number.isNaN(new Date(String(body.expiresAt) + "T12:00:00Z").getTime()) &&
      Object.prototype.hasOwnProperty.call(submission, "attribution")
  );
}

function ensureHeaders(sheet) {
  const legacyCount = EXPECTED_ADDITIONAL_HEADERS.length - 2;
  const current = sheet.getRange(HEADER_ROW, 13, 1, legacyCount).getDisplayValues()[0];
  if (current.some(function (value, index) { return value !== EXPECTED_ADDITIONAL_HEADERS[index]; })) {
    throw new Error("The discount sheet columns do not match the automation schema.");
  }
  if (sheet.getMaxColumns() < 30) sheet.insertColumnsAfter(sheet.getMaxColumns(), 30 - sheet.getMaxColumns());
  const newHeaders = EXPECTED_ADDITIONAL_HEADERS.slice(legacyCount);
  const added = sheet.getRange(HEADER_ROW, 29, 1, newHeaders.length).getDisplayValues()[0];
  if (added.every(function (value) { return value === ""; })) {
    sheet.getRange(HEADER_ROW, 29, 1, newHeaders.length).setValues([newHeaders]);
  } else if (added.some(function (value, index) { return value !== newHeaders[index]; })) {
    throw new Error("The new panel size/version columns do not match the automation schema.");
  }
}

function findSubmissionRow(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return 0;
  const match = sheet.getRange(FIRST_DATA_ROW, 26, lastRow - FIRST_DATA_ROW + 1, 1)
    .createTextFinder(submissionId)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function findCodeRow(sheet, code) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return 0;
  const match = sheet.getRange(FIRST_DATA_ROW, 1, lastRow - FIRST_DATA_ROW + 1, 1)
    .createTextFinder(code)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function deliverMessages(sheet, rowNumber, body, emailState, businessState) {
  const submission = body.submission;
  let emailSent = emailState === "ODESLÁNO";
  let businessNotified = businessState === "ODESLÁNO";
  const customerDeliveryUncertain = emailState === "ODESÍLÁ SE" || emailState === "CHYBA – zkontrolovat";
  const businessDeliveryUncertain = businessState === "ODESÍLÁ SE" || businessState === "CHYBA – zkontrolovat";

  if (!emailSent && !customerDeliveryUncertain) {
    sheet.getRange(rowNumber, 27).setValue("ODESÍLÁ SE");
    SpreadsheetApp.flush();
    try {
      sendCustomerEmail(submission, body.code, body.expiresAt);
      emailSent = true;
      sheet.getRange(rowNumber, 27).setValue("ODESLÁNO");
    } catch (error) {
      console.error("Customer code email failed.", error);
      sheet.getRange(rowNumber, 27).setValue("CHYBA – zkontrolovat");
    }
  }

  if (!businessNotified && !businessDeliveryUncertain) {
    sheet.getRange(rowNumber, 28).setValue("ODESÍLÁ SE");
    SpreadsheetApp.flush();
    try {
      sendBusinessEmail(submission, body.code, body.issuedAt, body.expiresAt, body.discountPolicy);
      businessNotified = true;
      sheet.getRange(rowNumber, 28).setValue("ODESLÁNO");
    } catch (error) {
      console.error("Business notification failed.", error);
      sheet.getRange(rowNumber, 28).setValue("CHYBA – zkontrolovat");
    }
  }

  return { emailSent: emailSent, businessNotified: businessNotified };
}

function sendCustomerEmail(submission, code, expiresAt) {
  const english = submission.locale === "en";
  const safeName = escapeHtml(submission.name);
  const expiry = formatDate(expiresAt, "dd.MM.yyyy", null);
  const subject = english ? "Your personal ANEW STYLE discount code" : "Váš osobní slevový kód ANEW STYLE";
  const body = english
    ? "Hello " + submission.name + ",\n\nthank you for your inquiry. Your personal discount code is " + code + ". It is valid until " + expiry + " and can be used once: 5% for SLIM or 7% for BASIC and DELUXE. Mention it when requesting a quote or during a consultation.\n\nANEW STYLE"
    : "Dobrý den " + submission.name + ",\n\n děkujeme za vaši poptávku. Váš osobní slevový kód je " + code + ". Platí do " + expiry + " a lze jej uplatnit jednou: 5 % pro SLIM nebo 7 % pro BASIC a DELUXE. Uveďte jej při poptávce nebo konzultaci.\n\nANEW STYLE";
  const htmlBody = english
    ? "<p>Hello " + safeName + ",</p><p>thank you for your inquiry. Your personal discount code is:</p><p style=\"font-size:24px;font-weight:bold;letter-spacing:2px\">" + code + "</p><p>It is valid until " + expiry + " and can be used once: 5% for SLIM or 7% for BASIC and DELUXE. Mention it when requesting a quote or during a consultation.</p><p>ANEW STYLE</p>"
    : "<p>Dobrý den " + safeName + ",</p><p>děkujeme za vaši poptávku. Váš osobní slevový kód je:</p><p style=\"font-size:24px;font-weight:bold;letter-spacing:2px\">" + code + "</p><p>Platí do " + expiry + " a lze jej uplatnit jednou: 5 % pro SLIM nebo 7 % pro BASIC a DELUXE. Uveďte jej při poptávce nebo konzultaci.</p><p>ANEW STYLE</p>";
  MailApp.sendEmail({ to: submission.email, subject: subject, body: body, htmlBody: htmlBody, name: "ANEW STYLE" });
}

function sendBusinessEmail(submission, code, issuedAt, expiresAt, discountPolicy) {
  const attribution = submission.attribution || {};
  const lines = [
    "Nová poptávka z webu ANEW STYLE",
    "Jméno: " + submission.name,
    "E-mail: " + submission.email,
    "Kategorie: " + panelCategoryLabel(submission.panelCategory),
    "Velikost panelu: " + (submission.size || "Neuvedena"),
    "Provedení: " + (submission.version || "Neuvedeno"),
    "Slevový kód: " + code,
    "Sleva: " + discountPolicy,
    "Vydáno: " + issuedAt,
    "Platnost do: " + expiresAt,
    "ID odeslání: " + submission.submissionId,
    "",
    "Poptávka:",
    submission.message || "(Bez doplňující zprávy)",
    "",
    "GCLID: " + (attribution.gclid || ""),
    "FBCLID: " + (attribution.fbclid || ""),
    "Zdroj: " + (attribution.source || ""),
    "UTM source: " + (attribution.utm_source || ""),
    "UTM medium: " + (attribution.utm_medium || ""),
    "UTM campaign: " + (attribution.utm_campaign || ""),
    "UTM content: " + (attribution.utm_content || ""),
    "UTM term: " + (attribution.utm_term || ""),
    "Vstupní stránka: " + (attribution.landing_page || ""),
    "Referrer: " + (attribution.referrer || ""),
  ];
  MailApp.sendEmail({
    to: BUSINESS_EMAIL,
    subject: "Nová poptávka a slevový kód – " + submission.name,
    body: lines.join("\n"),
    name: "ANEW STYLE web",
  });
}

function safeCell(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function discountRateForVersion(version) {
  if (version === "SLIM") return 0.05;
  if (version === "BASIC" || version === "DELUXE") return 0.07;
  return "";
}

function panelCategoryLabel(category) {
  if (category === "mineral") return "Svítící minerální panely";
  if (category === "stone") return "Svítící kamenné panely";
  return "Zatím nevím";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
  });
}

function formatDate(value, pattern, sheet) {
  const date = value instanceof Date ? value : new Date(value);
  const timeZone = sheet ? sheet.getParent().getSpreadsheetTimeZone() : "Europe/Prague";
  return Utilities.formatDate(date, timeZone, pattern);
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function output(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
