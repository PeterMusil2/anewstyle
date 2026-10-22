/**
 * Editor comfort for the ANEW STYLE admin:
 *
 * 1. Confirmation before every removal. Decap removes list items (FAQ
 *    questions, price versions…) and attached files instantly; we intercept
 *    those clicks and ask first. The gallery widget uses the same dialog
 *    (window.AnewConfirm). Deleting a whole entry already asks in Decap.
 *
 * 2. Guided tours (driver.js). One short tour per screen instead of one long
 *    one, so each explains exactly what is in front of the editor:
 *      intro    – the dashboard: sections, Schvalování, help button
 *      editor   – any edit screen: fields, Uložit, status, Publikovat
 *      gallery  – the gallery manager
 *      workflow – the Schvalování board
 *      publish  – the publishing process step by step (also from the help menu)
 *    Each runs automatically the first time its screen is opened; finishing
 *    or closing stores that in localStorage. The "Nápověda" button replays
 *    them at any time.
 */
(() => {
  // --------------------------------------------------------------- confirm
  const confirmCss = `
    .ax-confirm{border:0;padding:0;border-radius:10px;width:min(26rem,calc(100vw - 2rem));font:15px/1.5 system-ui,sans-serif;color:#1f2328;box-shadow:0 24px 64px rgb(0 0 0/.35)}
    .ax-confirm::backdrop{background:rgb(0 0 0/.5)}
    .ax-confirm form{display:flex;flex-direction:column;gap:16px;padding:24px}
    .ax-confirm h2{margin:0;font-size:18px}
    .ax-confirm p{margin:0;color:#3d444d}
    .ax-confirm .row{display:flex;justify-content:flex-end;gap:8px}
    .ax-confirm button{font:inherit;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #d0d7de;background:#fff;cursor:pointer}
    .ax-confirm button[value=ok]{background:#cf222e;border-color:#cf222e;color:#fff;font-weight:600}
    .ax-confirm button:focus-visible{outline:2px solid #7d6a3a;outline-offset:2px}`;

  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /** Modal yes/no. Resolves true only on the explicit confirm button. */
  window.AnewConfirm = ({ title = "Opravdu odebrat?", text = "", ok = "Odebrat", cancel = "Ponechat" } = {}) =>
    new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "ax-confirm";
      dialog.innerHTML = `<style>${confirmCss}</style>
        <form method="dialog">
          <h2>${escapeHtml(title)}</h2>
          ${text ? `<p>${escapeHtml(text)}</p>` : ""}
          <div class="row">
            <button value="cancel" autofocus>${escapeHtml(cancel)}</button>
            <button value="ok">${escapeHtml(ok)}</button>
          </div>
        </form>`;
      document.body.append(dialog);
      dialog.addEventListener("close", () => {
        resolve(dialog.returnValue === "ok");
        dialog.remove();
      });
      dialog.showModal();
    });

  // Decap's list-item remove button: the last icon button in a list item's
  // top bar. Attached-file "Odebrat …" buttons in image/file widgets.
  const isListRemove = (btn) =>
    btn.matches('[class*="TopBarButton"]') &&
    btn.parentElement?.matches('[class*="ListItemTopBar"]') &&
    btn === btn.parentElement.querySelector('[class*="TopBarButton"]:last-of-type');
  const isFileRemove = (btn) => /^Odebrat/i.test(btn.textContent.trim()) && !btn.closest(".gm, .ax-confirm");

  let bypass = false;
  document.addEventListener(
    "click",
    async (event) => {
      if (bypass) return;
      const btn = event.target.closest?.("button");
      if (!btn) return;
      const list = isListRemove(btn);
      if (!list && !isFileRemove(btn)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const label = list
        ? btn.parentElement.textContent.trim().slice(0, 80)
        : "";
      const ok = await window.AnewConfirm({
        title: list ? "Odebrat tuto položku?" : "Odebrat soubor?",
        text: list
          ? `${label ? `„${label}“ ` : ""}zmizí z formuláře. Na webu se změna projeví až po uložení a publikování.`
          : "Soubor se odpojí od tohoto pole. V Cloudinary zůstane uložený.",
      });
      if (!ok) return;
      bypass = true;
      btn.click();
      bypass = false;
    },
    true,
  );

  // ------------------------------------------------------------------ tours
  const DRIVER_JS = "https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js";
  const DRIVER_CSS = "https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css";
  const SEEN = (name) => `anewstyle-tour-${name}-v1`;

  let driverReady;
  const loadDriver = () =>
    (driverReady ??= new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = DRIVER_CSS;
      document.head.append(link);
      const script = document.createElement("script");
      script.src = DRIVER_JS;
      script.onload = () => resolve(window.driver.js.driver);
      script.onerror = reject;
      document.head.append(script);
    }));

  const $ = (sel) => document.querySelector(sel);
  const step = (element, title, description, side = "bottom") => ({
    element: typeof element === "string" ? ($(element) ? element : undefined) : element,
    popover: { title, description, side, align: "start" },
  });

  const PUBLISH_STEPS = [
    step(null, "Jak se změny dostanou na web",
      "Nic, co v administraci upravíte, se neukáže na webu hned. Každá změna projde třemi kroky:<br><br><b>1. Uložit</b> – vytvoří se <i>koncept</i>. Návštěvníci ho nevidí.<br><b>2. Stav</b> – koncept můžete označit jako <i>Ke kontrole</i> nebo <i>Připraveno</i> (např. aby se na něj podíval kolega).<br><b>3. Publikovat → Publikovat nyní</b> – změna se zapíše do webu a web se znovu sestaví."),
    step(null, "Kolik to trvá a jak poznám, že je hotovo",
      "Po publikování se vpravo dole objeví panel <b>„Publikováno – web se aktualizuje…“</b>. Sestavení webu trvá obvykle <b>2–3 minuty</b>. Když panel zezelená a napíše <b>„Hotovo – změny jsou na webu“</b>, klikněte na <i>Zobrazit na webu</i>.<br><br>Mezitím můžete normálně pracovat dál."),
    step(null, "Rozpracované změny najdete ve Schvalování",
      "Uložené, ale nepublikované koncepty jsou v záložce <b>Schvalování</b> nahoře. Tam je můžete otevřít, posunout mezi sloupci nebo publikovat. Dokud koncept nepublikujete, web zůstává beze změny – nemusíte se bát nic rozbít."),
  ];

  const TOURS = {
    intro: () => [
      step(null, "Vítejte v administraci webu ANEW STYLE",
        "Tady upravujete obsah webu anewstyle.cz – galerii, vzory kamene, ceník a časté dotazy. Provedu vás během minuty. Prohlídku můžete kdykoli zavřít a později spustit znovu tlačítkem <b>Nápověda</b> vlevo dole."),
      step('[class*="SidebarContainer"]', "Sekce webu",
        "Sekce odpovídají částem webu:<br><b>Galerie</b> – stránka Galerie (fotky, videa, 360°)<br><b>Vzory kamene</b> – karty v sekci Produkty<br><b>Ceník</b> – ceny a výbava<br><b>Časté dotazy</b> – otázky a odpovědi<br><br>Klikněte na sekci a otevře se její obsah.", "right"),
      step('a[href="#/workflow"]', "Schvalování",
        "Tady jsou uložené změny, které ještě nejsou na webu (koncepty). Odtud je můžete publikovat."),
      step('[class*="AppHeaderSiteLink"]', "Odkaz na web", "Otevře živý web v nové záložce, ať si můžete změny hned zkontrolovat."),
      ...PUBLISH_STEPS,
      step("#ax-help", "Nápověda je vždy po ruce",
        "Tímto tlačítkem si kdykoli pustíte prohlídku obrazovky, na které právě jste, nebo znovu vysvětlení publikování.", "top"),
    ],
    editor: () => [
      step('[class*="ToolbarSectionBackLink"]', "Úprava obsahu",
        "Jste v editoru. Šipkou vlevo se vrátíte zpět na seznam. Vedle vidíte, jestli máte <b>neuložené změny</b>."),
      step('[class*="SaveButton"]', "1. Uložit",
        "Po úpravách vždy klikněte na <b>Uložit</b>. Vznikne koncept – na webu se zatím nic nezmění."),
      step('[class*="ToolbarDropdown"]', "2. Stav a 3. Publikovat",
        "Po uložení se tu objeví <b>Stav</b> (Koncept / Ke kontrole / Připraveno) a tlačítko <b>Publikovat</b>. Volbou <b>Publikovat nyní</b> pošlete změnu na web – do 3 minut je venku a vpravo dole uvidíte průběh."),
      step('[class*="ControlPaneContainer"], [class*="EditorControlPane"], form', "Formulář",
        "Tady upravujete texty a hodnoty. Popisky nad poli říkají, kde se obsah na webu zobrazí. Položky seznamů rozbalíte šipkou, přidáte tlačítkem <b>Přidat</b> a odeberete křížkem – vždy se vás zeptám, jestli to myslíte vážně.", "top"),
    ],
    gallery: () => [
      step(".gm-help", "Galerie webu",
        "Tady je celá galerie z webu jako karty. Co tu vidíte, to je na webu – ve stejném pořadí."),
      step(".gm-bar", "Filtry",
        "Rychle přepnete mezi veřejnými médii, bonusem (zobrazí se až po odeslání formuláře), fotkami, videi, 360° nebo skrytými položkami. Číslo ukazuje počet."),
      step(".gm-primary", "Nahrát fotky a videa",
        "Vyberete, jestli médium patří do <b>veřejné galerie</b> nebo do <b>bonusu</b>, a jestli jde o fotku, video nebo 360° panoráma. Fotky a panorámata dostanou vodoznak a zkomprimují se přímo v prohlížeči. Můžete vybrat víc souborů najednou. Nové položky se objeví nahoře.", "left"),
      step(".gm-card", "Karta média",
        "Doplňte popisek (zobrazí se v galerii a pomáhá vyhledávačům), přepínačem <b>Veřejné / Bonus</b> určíte, kdo médium uvidí, <b>Skrýt</b> ho dočasně schová. Šipky mění pořadí, <b>výřez</b> určí, co z fotky bude vidět v dlaždici, koš médium odebere z webu (soubor samotný zůstane).", "right"),
      step('[class*="SaveButton"]', "Nezapomeňte uložit a publikovat",
        "Po úpravách galerie klikněte na <b>Uložit</b> a pak <b>Publikovat → Publikovat nyní</b>. Web se aktualizuje do 3 minut."),
    ],
    workflow: () => [
      step(null, "Schvalování",
        "Každá uložená změna je tu jako karta. Sloupce odpovídají stavu: <b>Koncept</b>, <b>Ke kontrole</b>, <b>Připraveno</b>. Kartu můžete přetáhnout do jiného sloupce nebo ji otevřít."),
      step(null, "Publikování odsud",
        "Ve sloupci <b>Připraveno</b> má každá karta tlačítko <b>Publikovat nové</b> / <b>Publikovat změny</b>. Tím změnu pošlete na web. Kartu, kterou nechcete, smažete – web zůstane beze změny."),
    ],
    publish: () => PUBLISH_STEPS,
  };

  const screen = () => {
    const hash = location.hash;
    if (hash.startsWith("#/workflow")) return "workflow";
    if (/#\/collections\/[^/]+\/(entries\/|new)/.test(hash)) return document.querySelector(".gm") ? "gallery" : "editor";
    return "intro";
  };

  let active = null;
  async function runTour(name) {
    const make = TOURS[name];
    if (!make) return;
    const driver = await loadDriver();
    active?.destroy();
    const steps = make();
    active = driver({
      showProgress: true,
      progressText: "{{current}} z {{total}}",
      nextBtnText: "Další →",
      prevBtnText: "← Zpět",
      doneBtnText: "Rozumím",
      allowClose: true,
      overlayColor: "rgb(0 0 0 / 0.6)",
      stagePadding: 6,
      popoverClass: "ax-tour",
      steps,
      onDestroyed: () => {
        try { localStorage.setItem(SEEN(name), "1"); } catch {}
        active = null;
        // After the intro, show the tour of the screen the editor is on.
        if (name === "intro") autoTour();
      },
    });
    active.drive();
  }

  const seen = (name) => {
    try { return localStorage.getItem(SEEN(name)) === "1"; } catch { return true; }
  };

  // Auto-run the tour for the current screen once its UI has rendered.
  let pendingAuto = null;
  function autoTour() {
    clearTimeout(pendingAuto);
    pendingAuto = setTimeout(() => {
      // The intro always comes first; the screen's own tour follows next time.
      const target = seen("intro") ? screen() : "intro";
      if (!seen(target) && !active && !document.querySelector("dialog[open]")) runTour(target);
    }, 1500);
  }

  // ------------------------------------------------------------ help button
  const helpCss = `
    #ax-help{position:fixed;left:16px;bottom:16px;z-index:9000;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#7d6a3a;color:#fff;font:600 14px/1 system-ui,sans-serif;box-shadow:0 8px 24px rgb(0 0 0/.25);cursor:pointer}
    #ax-help:hover{background:#6a5a31}
    #ax-help:focus-visible{outline:2px solid #1f2328;outline-offset:3px}
    #ax-help-menu{position:fixed;left:16px;bottom:68px;z-index:9000;display:flex;flex-direction:column;min-width:16rem;padding:6px;border-radius:10px;background:#fff;box-shadow:0 16px 40px rgb(0 0 0/.25);font:14px/1.4 system-ui,sans-serif}
    #ax-help-menu[hidden]{display:none}
    #ax-help-menu button{min-height:44px;padding:0 12px;border:0;border-radius:6px;background:none;text-align:left;font:inherit;color:#1f2328;cursor:pointer}
    #ax-help-menu button:hover,#ax-help-menu button:focus-visible{background:#f6f1e4;outline:none}
    .driver-popover.ax-tour{max-width:24rem;font-family:system-ui,sans-serif}
    .driver-popover.ax-tour .driver-popover-title{font-size:17px}
    .driver-popover.ax-tour .driver-popover-description{font-size:14px;line-height:1.55}
    .driver-popover.ax-tour .driver-popover-next-btn{background:#7d6a3a;color:#fff;text-shadow:none;border-color:#7d6a3a}`;

  function mountHelp() {
    if (document.getElementById("ax-help")) return;
    const style = document.createElement("style");
    style.textContent = helpCss;
    document.head.append(style);

    const btn = document.createElement("button");
    btn.id = "ax-help";
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "ax-help-menu");
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/></svg>Nápověda`;

    const menu = document.createElement("div");
    menu.id = "ax-help-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    const items = [
      ["here", "Prohlídka této obrazovky"],
      ["publish", "Jak publikovat změny"],
      ["intro", "Úvod do administrace"],
    ];
    menu.innerHTML = items.map(([k, l]) => `<button type="button" role="menuitem" data-tour="${k}">${l}</button>`).join("");

    const toggle = (open) => {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector("button").focus();
    };
    btn.addEventListener("click", () => toggle(menu.hidden));
    menu.addEventListener("click", (e) => {
      const key = e.target.closest("button")?.dataset.tour;
      if (!key) return;
      toggle(false);
      runTour(key === "here" ? screen() : key);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) { toggle(false); btn.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) toggle(false);
    });

    document.body.append(menu, btn);
  }

  // Decap renders asynchronously; wait for the app shell, then follow routes.
  const boot = () => {
    if (!document.querySelector('[class*="AppHeader"]')) return setTimeout(boot, 500);
    mountHelp();
    autoTour();
  };
  window.addEventListener("hashchange", autoTour);
  boot();
})();
