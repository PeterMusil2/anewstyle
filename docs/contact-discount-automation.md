# Automated contact discount codes

## What happens after submission

1. The contact form posts to the same-origin Cloudflare Pages Function at `/api/contact`.
2. The function validates the form, creates a cryptographically random, branded code in the form `ANEW-XXXXXXXX`, and sets an expiry 180 days after issue. Previously issued `AS-XXXXX-XXXXX` codes remain valid for retries.
3. A private Apps Script endpoint checks the shared secret and writes the inquiry, code, category, attribution and delivery states to the `Kódy` tab in the private discount register.
4. After the row is written, Apps Script emails the code to the visitor and sends the inquiry to `info@anewstyle.cz`.
5. The page shows the code only after the register confirms the write. It also unlocks the bonus gallery in that browser. If a mail send fails, the code still appears and the sheet marks the failed delivery for follow-up.

The same form submission ID is reused after a network error. Apps Script uses it to return the original code instead of appending a second row. Before sending either e-mail, it records `ODESÍLÁ SE`; if a request stops at that point or reports an ambiguous sending error, automatic retries do not send that message again. Check the mailbox and resolve such rows manually. The form stores name, email, optional panel size and version, an optional message, stone/mineral/undecided panel category, gclid/fbclid, source, UTM parameters, landing page, referrer, code and the two email delivery states. The category is written to the existing `Kategorie panelu` column as `Svítící kamenné panely`, `Svítící minerální panely`, or `Zatím nevím`.

## One-time Google Apps Script setup

1. Open the private spreadsheet **Evidence slevových kódů ANEW STYLE** while signed in with the account that owns the register.
2. Choose **Extensions → Apps Script**. Replace the starter file with `scripts/contact-automation/Code.gs` from this repository and save it.
3. In Apps Script **Project Settings → Script properties**, add:
   - `SPREADSHEET_ID` — the ID from the sheet URL (this stays in the Apps Script properties, not the repository).
   - `CONTACT_SHARED_SECRET` — a new random value of at least 32 characters. Do not commit it or send it in e-mail/chat.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as** to the account that owns the sheet and **Who has access** to **Anyone**. Deploy and approve the requested Sheets and Mail permissions. Copy the URL ending in `/exec`.
5. In Cloudflare Pages → project `anewstyle` → **Settings → Variables and Secrets**, add for the **Production** environment:
   - `CONTACT_SHEETS_WEB_APP_URL` — the Apps Script `/exec` URL (plain variable).
   - `CONTACT_SHEETS_SHARED_SECRET` — the exact same value as `CONTACT_SHARED_SECRET` (secret).
6. Add the same two values to the Preview environment before testing a Pages preview. Never add them to frontend code, `wrangler.toml`, or a committed `.dev.vars` file.
7. After the site code is deployed and both production values are saved, send one real test inquiry. Confirm the generated code is shown, the new row is present, and both delivery-state cells say `ODESLÁNO`. Then remove the test row and void the test code.

If `anewstyle.brno@gmail.com` is the account used to deploy the Apps Script, customer messages will be sent from that account with the display name **ANEW STYLE**. The business notification goes to `info@anewstyle.cz`.

## Local Pages Functions

Astro's `bun run dev` does not execute Cloudflare Pages Functions. To test the function locally, build the site and run `wrangler pages dev dist` with a local `.dev.vars` containing the two variables above. Keep `.dev.vars` out of Git. A local test writes real personal data and sends real e-mails, so use a dedicated test address and remove the corresponding test data afterward.

## Sheet fields

The existing columns A–L remain available for the code, discount, status and later manual redemption. Column E (`Sleva (%)`) stores a numeric percentage for the selected version: 5% for SLIM and 7% for BASIC or DELUXE. If the visitor leaves the version undecided, the percentage stays blank until the team confirms the version. The added columns M–AB store the customer's name and message, panel category, advertising attribution, form submission ID and e-mail delivery states. Columns AC and AD store the selected panel size and version; the updated Apps Script adds these headers to an existing sheet the first time it receives a valid inquiry. The spreadsheet time zone is set to `Europe/Prague` for issue and expiry dates.
