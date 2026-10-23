---
name: client-handoff
description: Hand changes or the whole site to the ANEW STYLE team – final verification, plain-language guide for editors (Czech), inviting editors, notes for the next agent. Use at a release milestone or when the user asks for a client document / návod pro klienta.
---

# Client handoff

## 1. Final verification

- The full validation process in `AGENTS.md` on the production domain (`performance-audit`, `accessibility-audit`, `seo-audit`).
- Contact form: one real submission arrives (Web3Forms), the thank-you dialog shows.
- CMS: an **editor** account (not only the owner) logs in, edits a text, uploads a gallery photo (watermark visible), publishes; the change appears on the site.

## 2. Editors

Invite each editor as a collaborator with write access (`decap-cms`). They accept the invitation, then log in at `https://anewstyle.cz/admin/` → "Přihlásit pomocí GitHub".

## 3. Guide (Czech, non-technical)

Short, concrete, with screenshots (desktop, mobile, admin): what changed, how to edit each CMS section (Galerie, Vzory panelů, Ceník, Časté dotazy), photos (watermark is automatic only in Galerie, crop focus, bonus, hide, order), Save = draft → Publikovat → live in 2–3 min, what is still edited in code (UI texts) and who to ask. Build it as HTML with print CSS and render to PDF with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --allow-file-access-from-files --virtual-time-budget=8000 \
  --print-to-pdf="$PWD/guide.pdf" "file://$PWD/guide.html"
```

Check every page image before sending; keep the source in `docs/klient/`. No private e-mails or secrets; ask the user to confirm prices or limits you could not verify.

## 4. For the next agent

Update `CLAUDE.md` / `AGENTS.md` with client-specific facts and decisions, and leave a note in `docs/` for anything pending.
