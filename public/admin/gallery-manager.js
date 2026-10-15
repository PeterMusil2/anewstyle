/**
 * "gallery-manager" widget: the whole website gallery on one screen.
 *
 * Every card is one item of the gallery exactly as the website shows it:
 * thumbnail, caption, public/bonus, hidden, order, remove. New files are
 * uploaded straight to Cloudinary (see cloudinary-upload.js) and appended.
 *
 * Value: array of { media, alt: { cs, en }, bonus, panorama, hidden }.
 */
(() => {
  const { h, createClass } = window;
  // Resolved on use: cloudinary-upload.js defines it, and a stale cached copy
  // of that file must not crash the whole editor.
  const AC = new Proxy({}, { get: (_, key) => window.AnewCloudinary?.[key] ?? (() => "") });

  const toArray = (value) => {
    const plain = value?.toJS ? value.toJS() : value;
    return Array.isArray(plain) ? plain : [];
  };

  const kindOf = (item) => {
    const p = AC.parse(item.media);
    if (p?.kind === "video") return "video";
    if (item.panorama || /\/360\//.test(p?.id || "")) return "360";
    return "image";
  };
  const fileName = (item) => (AC.parse(item.media)?.id || "").split("/").pop();

  // Lucide-style icons (stroke, 24 viewBox), always paired with text or a label.
  const ICONS = {
    image: "M3 5h18v14H3z M8.5 10a1.5 1.5 0 1 0 0-.01 M21 15l-5-5L5 19",
    video: "M3 6h13v12H3z M16 10l5-3v10l-5-3",
    "360": "M12 3a9 9 0 1 0 9 9 M12 3c2.5 2.5 2.5 15.5 0 18 M12 3c-2.5 2.5-2.5 15.5 0 18 M3 12h18",
    up: "M6 15l6-6 6 6",
    down: "M6 9l6 6 6-6",
    trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
    upload: "M12 16V4 M7 9l5-5 5 5 M4 20h16",
    eyeOff: "M3 3l18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.1A9.8 9.8 0 0 1 21 12a13 13 0 0 1-2.2 3.1 M6.6 6.6A13 13 0 0 0 3 12a9.8 9.8 0 0 0 11.4 5.6",
    lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  };
  const icon = (name, size = 18) =>
    h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
      h("path", { d: ICONS[name] }));

  const KIND_LABEL = { image: "Fotka", video: "Video", "360": "360°" };
  const FILTERS = [
    ["all", "Vše"], ["public", "Veřejné"], ["bonus", "Bonus"],
    ["image", "Fotky"], ["video", "Videa"], ["360", "360°"], ["hidden", "Skryté"],
  ];
  const matches = (item, filter) => {
    switch (filter) {
      case "public": return !item.bonus;
      case "bonus": return Boolean(item.bonus);
      case "hidden": return Boolean(item.hidden);
      case "image": case "video": case "360": return kindOf(item) === filter;
      default: return true;
    }
  };

  const STYLE = `
  .gm{--gold:#7d6a3a;--gold-bg:#f6f1e4;--line:#d0d7de;--muted:#57606a;font:14px/1.5 system-ui,sans-serif;color:#1f2328}
  .gm button,.gm select,.gm input{font:inherit}
  .gm :focus-visible{outline:2px solid var(--gold);outline-offset:2px}
  .gm-help{margin:0 0 16px;padding:12px 16px;border-radius:8px;background:var(--gold-bg);color:#3d331b}
  .gm-help strong{color:#1f2328}
  .gm-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 0;background:#fff;border-bottom:1px solid var(--line);margin-bottom:16px}
  .gm-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:#fff;cursor:pointer;transition:background .2s,border-color .2s}
  .gm-chip[aria-pressed=true]{background:var(--gold);border-color:var(--gold);color:#fff}
  .gm-chip span{opacity:.75}
  .gm-primary{margin-left:auto;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border:0;border-radius:8px;background:var(--gold);color:#fff;font-weight:600;cursor:pointer}
  .gm-primary:hover{background:#6a5a31}
  .gm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
  .gm-card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
  .gm-card[data-hidden=true] .gm-thumb img{opacity:.35}
  .gm-thumb{position:relative;aspect-ratio:16/9;background:#111;display:block}
  .gm-thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .gm-badges{position:absolute;inset:8px 8px auto 8px;display:flex;flex-wrap:wrap;gap:6px}
  .gm-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgb(0 0 0/.7);color:#fff;font-size:12px;font-weight:600}
  .gm-badge.bonus{background:var(--gold)}
  .gm-body{display:flex;flex-direction:column;gap:8px;padding:12px}
  .gm-name{font-size:12px;color:var(--muted);word-break:break-all}
  .gm-body label{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:600;color:var(--muted)}
  .gm-body input[type=text]{min-height:36px;padding:0 10px;border:1px solid var(--line);border-radius:6px;font-weight:400;color:#1f2328}
  .gm-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .gm-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  .gm-seg button{min-height:36px;padding:0 10px;border:0;background:#fff;cursor:pointer}
  .gm-seg button[aria-pressed=true]{background:var(--gold-bg);color:#3d331b;font-weight:600}
  .gm-check{flex-direction:row!important;align-items:center;gap:6px!important;font-weight:400!important;color:#1f2328!important;min-height:36px;cursor:pointer}
  .gm-icon{display:inline-grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer;color:#1f2328}
  .gm-icon:disabled{opacity:.35;cursor:not-allowed}
  .gm-icon.danger{color:#cf222e}
  .gm-actions{display:flex;align-items:center;gap:6px;margin-top:4px}
  .gm-actions .gm-icon.danger{margin-left:auto}
  .gm-confirm{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:13px}
  .gm-confirm button{min-height:36px;padding:0 10px;border-radius:6px;border:1px solid var(--line);background:#fff;cursor:pointer}
  .gm-confirm button.yes{background:#cf222e;border-color:#cf222e;color:#fff}
  .gm-empty{padding:40px;text-align:center;border:2px dashed var(--line);border-radius:10px;color:var(--muted)}
  @media (prefers-reduced-motion:reduce){.gm *{transition:none!important}}`;

  const GalleryControl = createClass({
    getInitialState() {
      return { filter: "all" };
    },

    items() {
      return toArray(this.props.value);
    },

    commit(next) {
      this.props.onChange(next);
    },

    update(index, patch) {
      const next = this.items().map((item, i) => (i === index ? { ...item, ...patch } : item));
      this.commit(next);
    },

    updateAlt(index, lang, text) {
      const item = this.items()[index];
      this.update(index, { alt: { cs: "", en: "", ...(item.alt || {}), [lang]: text } });
    },

    // Move among the items visible under the current filter, so "up" always
    // swaps with the card the editor sees before it.
    move(index, dir) {
      const items = this.items();
      const visible = items.map((it, i) => [it, i]).filter(([it]) => matches(it, this.state.filter)).map(([, i]) => i);
      const pos = visible.indexOf(index);
      const target = visible[pos + dir];
      if (target === undefined) return;
      const next = items.slice();
      [next[index], next[target]] = [next[target], next[index]];
      this.commit(next);
    },

    async askRemove(index, name) {
      const ask = window.AnewConfirm ?? (async () => window.confirm("Odebrat z webu?"));
      const ok = await ask({
        title: "Odebrat médium z webu?",
        text: `„${name}“ zmizí z galerie po uložení a publikování. Soubor v Cloudinary zůstane, takže ho lze později vrátit.`,
        ok: "Odebrat z webu",
      });
      if (ok) this.commit(this.items().filter((_, i) => i !== index));
    },

    async add() {
      const target = this.state.filter === "bonus" ? "bonus" : "gallery";
      const uploaded = await AC.openDialog({ multiple: true, target });
      if (!uploaded.length) return;
      const added = uploaded.map(({ url, target: t, kind }) => ({
        media: url, alt: { cs: "", en: "" }, bonus: t === "bonus", panorama: kind === "360", hidden: false,
      }));
      // Newest first so the editor sees them straight away.
      this.commit([...added, ...this.items()]);
    },

    renderCard(item, index, visiblePos, visibleCount) {
      const kind = kindOf(item);
      const name = fileName(item);
      return h("article", { key: item.media + index, className: "gm-card", "data-hidden": String(Boolean(item.hidden)) },
        h("a", { className: "gm-thumb", href: item.media, target: "_blank", rel: "noopener", title: "Otevřít originál v nové záložce" },
          h("img", { src: AC.thumbOf(item.media), alt: item.alt?.cs || name, loading: "lazy", decoding: "async" }),
          h("div", { className: "gm-badges" },
            h("span", { className: "gm-badge" }, icon(kind, 14), KIND_LABEL[kind]),
            item.bonus && h("span", { className: "gm-badge bonus" }, icon("lock", 14), "Bonus"),
            item.hidden && h("span", { className: "gm-badge" }, icon("eyeOff", 14), "Skryto"))),
        h("div", { className: "gm-body" },
          h("div", { className: "gm-name" }, name),
          h("label", null, "Popisek česky",
            h("input", { type: "text", value: item.alt?.cs || "", placeholder: "např. Obývací pokoj – panel XL", onChange: (e) => this.updateAlt(index, "cs", e.target.value) })),
          h("label", null, "Popisek anglicky",
            h("input", { type: "text", value: item.alt?.en || "", onChange: (e) => this.updateAlt(index, "en", e.target.value) })),
          h("div", { className: "gm-row" },
            h("div", { className: "gm-seg", role: "group", "aria-label": "Kde se zobrazí" },
              h("button", { type: "button", "aria-pressed": String(!item.bonus), onClick: () => this.update(index, { bonus: false }) }, "Veřejné"),
              h("button", { type: "button", "aria-pressed": String(Boolean(item.bonus)), onClick: () => this.update(index, { bonus: true }) }, "Bonus")),
            h("label", { className: "gm-check" },
              h("input", { type: "checkbox", checked: Boolean(item.hidden), onChange: (e) => this.update(index, { hidden: e.target.checked }) }),
              "Skrýt"),
            kind !== "video" && h("label", { className: "gm-check" },
              h("input", { type: "checkbox", checked: kind === "360", onChange: (e) => this.update(index, { panorama: e.target.checked }) }),
              "360°")),
          h("div", { className: "gm-actions" },
            h("button", { type: "button", className: "gm-icon", "aria-label": "Posunout dříve", title: "Posunout dříve", disabled: visiblePos === 0, onClick: () => this.move(index, -1) }, icon("up")),
            h("button", { type: "button", className: "gm-icon", "aria-label": "Posunout později", title: "Posunout později", disabled: visiblePos === visibleCount - 1, onClick: () => this.move(index, 1) }, icon("down")),
            h("button", { type: "button", className: "gm-icon danger", "aria-label": `Odebrat ${name} z webu`, title: "Odebrat z webu", onClick: () => this.askRemove(index, name) }, icon("trash")))));
    },

    render() {
      const items = this.items();
      const { filter } = this.state;
      const visible = items.map((item, index) => ({ item, index })).filter(({ item }) => matches(item, filter));
      const count = (f) => items.filter((it) => matches(it, f)).length;

      return h("div", { className: `gm ${this.props.classNameWrapper || ""}`, id: this.props.forID },
        h("style", null, STYLE),
        h("p", { className: "gm-help" },
          h("strong", null, "Tady je celá galerie webu. "),
          "Pořadí karet = pořadí na webu (videa, fotky a 360° se na webu řadí do skupin). ",
          h("strong", null, "Bonus"), " se zobrazí až po odeslání kontaktního formuláře. ",
          "Po úpravách klikněte nahoře na ", h("strong", null, "Uložit"), " a pak ", h("strong", null, "Publikovat"), " – web se aktualizuje do 3 minut."),
        h("div", { className: "gm-bar", role: "toolbar", "aria-label": "Filtr galerie" },
          ...FILTERS.map(([key, label]) =>
            h("button", { key, type: "button", className: "gm-chip", "aria-pressed": String(filter === key), onClick: () => this.setState({ filter: key }) },
              label, h("span", null, count(key)))),
          h("button", { type: "button", className: "gm-primary", onClick: () => this.add() }, icon("upload"), "Nahrát fotky / videa")),
        visible.length
          ? h("div", { className: "gm-grid" },
              ...visible.map(({ item, index }, pos) => this.renderCard(item, index, pos, visible.length)))
          : h("div", { className: "gm-empty" },
              items.length ? "V tomto filtru nic není." : "Galerie je prázdná. Začněte tlačítkem „Nahrát fotky / videa“."));
    },
  });

  const GalleryPreview = createClass({
    render() {
      return h("p", null, `${toArray(this.props.value).length} položek galerie`);
    },
  });

  window.CMS.registerWidget("gallery-manager", GalleryControl, GalleryPreview);
})();
