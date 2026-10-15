/**
 * Single-file media fields for the CMS (product photos and 3D models).
 *
 *  media-image – thumbnail + "Nahrát / Vyměnit" + "Odebrat"
 *  media-file  – file name + the same buttons (3D .glb models)
 *
 * Values are site paths (/images/…, /3d/…) for the original files and full
 * Cloudinary URLs for anything uploaded through the CMS.
 */
(() => {
  const { h, createClass } = window;
  const AC = new Proxy({}, { get: (_, key) => window.AnewCloudinary?.[key] ?? (() => "") });

  const preview = (value) => {
    if (!value) return "";
    // Cloudinary: a small, cached rendition. Local files: the file itself.
    const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?:v\d+\/)?(.+)$/.exec(value);
    return m ? `${m[1]}c_limit,f_auto,q_auto,w_400/${m[2]}` : value;
  };
  const fileName = (value) => decodeURIComponent(String(value || "").split("?")[0].split("/").pop() || "");

  const STYLE = `
    .mw{display:flex;gap:16px;align-items:center;flex-wrap:wrap;font:14px/1.5 system-ui,sans-serif}
    .mw-thumb{width:220px;aspect-ratio:2/1;border-radius:8px;overflow:hidden;background:#111;display:grid;place-items:center;color:#8c959f}
    .mw-thumb img{width:100%;height:100%;object-fit:contain;display:block}
    .mw-file{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid #d0d7de;border-radius:8px;background:#f6f8fa;font-family:ui-monospace,monospace;font-size:13px;word-break:break-all}
    .mw-actions{display:flex;gap:8px;flex-wrap:wrap}
    .mw button{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid #d0d7de;background:#fff;font:inherit;cursor:pointer}
    .mw button.primary{background:#7d6a3a;border-color:#7d6a3a;color:#fff;font-weight:600}
    .mw button.danger{color:#cf222e}
    .mw button:focus-visible{outline:2px solid #7d6a3a;outline-offset:2px}
    .mw-empty{color:#57606a}`;

  const makeControl = (kind) =>
    createClass({
      async upload() {
        const cfg = this.props.field.get("media_library")?.get("config")?.toJS?.() || {};
        const [first] = await AC.openDialog({ folder: cfg.folder?.path || cfg.folder || "" });
        if (first) this.props.onChange(first.url);
      },
      async remove() {
        const ask = window.AnewConfirm ?? (async () => window.confirm("Odebrat soubor?"));
        const ok = await ask({
          title: kind === "image" ? "Odebrat fotku?" : "Odebrat 3D model?",
          text: "Pole zůstane prázdné. Soubor samotný se nemaže a lze ho znovu nahrát.",
          ok: "Odebrat",
        });
        if (ok) this.props.onChange("");
      },
      render() {
        const { value, forID, classNameWrapper } = this.props;
        return h("div", { id: forID, className: `mw ${classNameWrapper || ""}` },
          h("style", null, STYLE),
          kind === "image"
            ? h("div", { className: "mw-thumb" },
                value ? h("img", { src: preview(value), alt: "", loading: "lazy" }) : "Bez fotky")
            : value
              ? h("span", { className: "mw-file" }, fileName(value))
              : h("span", { className: "mw-empty" }, "Zatím bez souboru"),
          h("div", { className: "mw-actions" },
            h("button", { type: "button", className: "primary", onClick: () => this.upload() },
              value ? "Vyměnit soubor…" : "Nahrát soubor…"),
            value && h("button", { type: "button", className: "danger", onClick: () => this.remove() }, "Odebrat")));
      },
    });

  const Preview = createClass({
    render() {
      return this.props.value ? h("span", null, fileName(this.props.value)) : null;
    },
  });

  window.CMS.registerWidget("media-image", makeControl("image"), Preview);
  window.CMS.registerWidget("media-file", makeControl("file"), Preview);
})();
