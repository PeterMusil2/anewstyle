# ANEW STYLE – čo treba nastaviť po redesigne

Návod krok za krokom pre vetvu `feat/redesign-tailwind4`: od lokálneho
spustenia cez nasadenie a prihlasovanie do CMS až po nahrávanie médií do
Cloudinary.

---

## 1. Lokálne spustenie a kontrola

1. Prepni sa na vetvu a nainštaluj závislosti (pribudol Tailwind 4,
   TypeScript 7, decap-server; Sass a PostCSS sú preč):

   ```bash
   git checkout feat/redesign-tailwind4
   bun install
   ```

2. Spusti web a prejdi ho v prehliadači (svetlá aj tmavá téma, mobil):

   ```bash
   bun run dev            # http://localhost:4321
   ```

3. Overenie buildu (rovnaký príkaz ako na Cloudflare):

   ```bash
   bun run build          # gallery:build → astro check + TS 7 → astro build
   bun run preview
   ```

4. CMS lokálne (bez GitHubu, zmeny sa zapisujú priamo do súborov):

   ```bash
   bun run cms:local      # v druhom termináli popri `bun run dev`
   # otvor http://localhost:4321/admin/
   ```

   Pozor: tlačidlo na nahrávanie médií otvára Cloudinary aj lokálne, takže
   nahraté súbory sa reálne uložia do Cloudinary.

---

## 2. Cloudflare Pages – nasadenie vetvy

1. Pushni vetvu: `git push -u origin feat/redesign-tailwind4`.
   Cloudflare spraví **preview deploy** (`*.anewstyle.pages.dev`).
2. Skontroluj v Cloudflare → *Workers & Pages* → projekt → *Settings → Build*:
   - Build command: `bun run build`
   - Build output directory: `dist`
   - (voliteľne) premenná `BUN_VERSION` – aktuálna verzia, napr. `1.3.x`
3. *Settings → Variables and Secrets* – musí existovať (Production aj Preview):
   - `CLOUDINARY_URL` = `cloudinary://API_KEY:API_SECRET@lukaschylik` (Encrypt)
4. Na preview adrese skontroluj, čo som nevedel overiť ja:
   - video v úvode stránky,
   - fotky, videá a 360° v galérii (načítajú sa z Cloudinary),
   - 3D model a „Zobraz u mě doma“ (AR) na mobile.
5. Funkcia `/mcp` beží ako Pages Function – priečinok `functions/` Cloudflare
   nasadí automaticky, nič netreba nastavovať.

---

## 3. Prihlasovanie do CMS (GitHub OAuth)

CMS (`/admin/`) ukladá zmeny do GitHub repozitára `PeterMusil2/anewstyle`.
Prihlásenie cez GitHub obsluhujú funkcie `functions/api/auth.ts` a
`functions/api/callback.ts` – potrebujú OAuth aplikáciu.

1. GitHub → *Settings → Developer settings → OAuth Apps → New OAuth App*
   - **Application name:** ANEW STYLE CMS
   - **Homepage URL:** `https://anewstyle.cz`
   - **Authorization callback URL:** `https://anewstyle.cz/api/callback`
2. Skopíruj **Client ID** a vygeneruj **Client secret**.
3. Cloudflare → projekt → *Settings → Variables and Secrets* → **Production**:
   - `GITHUB_CLIENT_ID` = Client ID
   - `GITHUB_CLIENT_SECRET` = Client secret → **Encrypt**
4. Redeploy (stačí *Retry deployment* posledného buildu).
5. Každý editor potrebuje GitHub účet s právom **Write** do repozitára
   (*Repo → Settings → Collaborators*).

> CMS je nastavené na `https://anewstyle.cz` (`base_url` v
> `public/admin/config.yml`), takže prihlásenie funguje až na produkčnej
> doméne po zmergovaní – na `*.pages.dev` preview nie.

**Ako sa publikuje:** CMS používa *editorial workflow* – zmena sa uloží ako
koncept (pull request), Cloudflare k nej postaví preview, a až po
*Ready → Publish* sa zmerguje do `master` a ide naostro.

---

## 4. Cloudinary – nahrávanie fotiek a videí z CMS

### 4.1 Jednorazové nastavenie

Editori **nepotrebujú účet v Cloudinary**. Nahrávacie okno v CMS pošle súbor
priamo do Cloudinary; podpis nahrávania vydá funkcia `/api/cloudinary` iba
tomu, kto je v CMS prihlásený GitHub účtom s právom zápisu do repozitára.

1. Cloudflare → *Variables and Secrets*: `CLOUDINARY_URL` (už je) – funkcia z
   neho berie API kľúč a secret.
2. *(Voliteľné)* `DEPLOY_HOOK_URL` (Secret) = URL deploy hooku z
   *Settings → Builds → Deploy hooks*. Po nahratí sa web hneď prebuildí.
   Ak už Cloudinary volá deploy hook cez *Settings → Upload → Notification
   URL*, netreba.
3. Cloudinary → *Settings → Security* → *Strict transformations* **vypnuté**.

### 4.2 Galéria v CMS (pre editora)

`https://anewstyle.cz/admin/` → **Galerie → Galerie webu**. Na jednej obrazovke
sú všetky fotky, videá a 360° z webu ako karty s náhľadom.

- **Filtre** hore: Vše / Veřejné / Bonus / Fotky / Videa / 360° / Skryté.
- **Nahrát fotky / videa** – vyberieš, či ide do verejnej galérie alebo do
  bonusu a čo nahrávaš (fotka, video, 360°); dá sa vybrať viac súborov naraz.
- Na karte: popisok CZ/EN, prepínač **Veřejné / Bonus**, **Skrýt**, **360°**,
  šípky na poradie a kôš (**Odebrat z webu**, s potvrdením).
- Hotovo → **Uložit** → **Publikovat**. Web sa aktualizuje do 3 minút.

Zoznam v CMS je presne to, čo je na webe. Odobratím položky zmizne z webu,
súbor v Cloudinary ostane (dá sa vrátiť). Súbory nahrané priamo v Cloudinary
konzole sa na web dostanú až po pridaní do CMS.

### 4.3 Ako sa médiá zobrazia (formát a veľkosť rieši web sám)

| Typ | Čo nahrať | Čo z toho web spraví |
| --- | --- | --- |
| Fotka | JPG/PNG/WebP, ideálne ≥ 2000 px na dlhšej strane | Dlaždica orezaná na 16:9 (na šírku) alebo 9:16 (na výšku) s inteligentným výrezom, formát (AVIF/WebP/JPG) volí Cloudinary podľa prehliadača, šírky 400–1600 px; v lightboxe celá fotka do 1600 px |
| Video | MP4 (H.264), 1080p, rozumne krátke | MP4 do šírky 1280 px, náhľad (JPG) sa vytvorí z videa automaticky |
| 360° | rovnobežková panoráma 2:1 (napr. 8192 × 4096), zapnúť „360°“ | Náhľad 16:9, prehliadač panorámy v rozlíšení 4096 px |
| Bonus | ako vyššie, zoznam **Bonusový obsah** | Skryté, kým návštevník neodošle kontaktný formulár |

Orientáciu (na šírku / na výšku) a orez rieši build automaticky – netreba nič
upravovať ručne. Pri fotke na výšku sa vytvorí dlaždica na výšku.

---

## 5. Zmergovanie do produkcie

1. Na preview prejdi checklist z bodu 2.4.
2. Zmerguj `feat/redesign-tailwind4` → `master` (PR na GitHube).
3. Po nasadení over na `https://anewstyle.cz`:
   - `/admin/` – prihlásenie cez GitHub, úprava napr. FAQ (koncept → Publish).
   - Nahratie jednej testovacej fotky do galérie (bod 4.2) a kontrola na webe.
   - `/llms.txt`, `/agent/site.json` – dáta pre AI agentov.
   - MCP server:

     ```bash
     curl -s https://anewstyle.cz/mcp \
       -H 'Content-Type: application/json' \
       -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
     ```

   - [Rich Results Test](https://search.google.com/test/rich-results) pre
     `https://anewstyle.cz/` (produkty, FAQ, showroom).
   - Lighthouse (Chrome DevTools) – mobil aj desktop.
4. Google Search Console → znova odošli `sitemap-index.xml`.

---

## 6. Rýchla referencia

| Čo | Kde |
| --- | --- |
| Farby, písmo, rozostupy (design tokeny) | `src/styles/global.css` |
| Efekty mimo Tailwindu (CSS-first) | `src/styles/effects.css` |
| Ceník | CMS → Ceník (`src/data/prices.json`) |
| FAQ | CMS → Časté dotazy (`src/data/faq.json`) |
| Vzory kameňa | CMS → Vzory kamene (`src/data/products.json`, poradie ťahaním) |
| Galéria – metadáta | CMS → Galerie (`src/data/gallery-cms.json`) |
| Dáta pre agentov (JSON-LD, llms.txt, MCP, WebMCP) | `src/lib/site-data.ts` |
| Nasadenie, OAuth, Cloudinary | `DEPLOY.md` |
