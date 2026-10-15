/**
 * Cloudinary uploads for Decap CMS without a Cloudinary account.
 *
 * /api/cloudinary checks the editor's CMS (GitHub) login and signs each
 * upload; the file then goes straight from the browser to Cloudinary.
 *
 * Exposes window.AnewCloudinary for gallery-manager.js and registers the
 * "anewstyle-cloudinary" media library used by the product image fields.
 *
 * Field config (config.yml → media_library.config):
 *   folder: { path: "…" }   fixed folder (products)
 */
(() => {
  const TARGETS = [["gallery", "Veřejná galerie"], ["bonus", "Bonus (po odeslání formuláře)"]];
  const KINDS = [["images", "Fotka"], ["videos", "Video"], ["360", "360° panorama"]];

  const token = () => {
    for (const key of ["decap-cms-user", "netlify-cms-user"]) {
      try {
        const user = JSON.parse(localStorage.getItem(key) || "null");
        if (user?.token) return user.token;
      } catch {}
    }
    return "";
  };

  const api = async (body) => {
    const res = await fetch("/api/cloudinary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };

  const upload = (file, sig, onProgress) =>
    new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("use_filename", "true");
      form.append("unique_filename", "true");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch {}
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error?.message || `HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Nahrávání selhalo – zkontrolujte připojení."));
      xhr.send(form);
    });

  /** res.cloudinary.com URL → { cloud, kind, id } */
  const parse = (url) => {
    const m = /res\.cloudinary\.com\/([^/]+)\/(image|video)\/upload\/(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:\?.*)?$/i.exec(url || "");
    return m ? { cloud: m[1], kind: m[2], id: m[3] } : null;
  };

  // Thumbnails reuse the transformations the website already serves, so the
  // CMS creates no new Cloudinary derivatives (no extra credits).
  const thumbOf = (url) => {
    const p = parse(url);
    if (!p) return "";
    return p.kind === "video"
      ? `https://res.cloudinary.com/${p.cloud}/video/upload/c_limit,q_auto,w_800/v1/${p.id}.jpg`
      : `https://res.cloudinary.com/${p.cloud}/image/upload/ar_16:9,c_fill,f_auto,g_auto,q_auto,w_400/v1/${p.id}`;
  };

  const css = `
    .acu{border:0;padding:0;border-radius:10px;width:min(34rem,calc(100vw - 2rem));font:15px/1.5 system-ui,sans-serif;color:#1f2328;box-shadow:0 24px 64px rgb(0 0 0/.35)}
    .acu::backdrop{background:rgb(0 0 0/.5)}
    .acu form{display:flex;flex-direction:column;gap:18px;padding:24px}
    .acu h2{margin:0;font-size:19px}
    .acu fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
    .acu legend{font-weight:600;margin-bottom:6px}
    .acu label.opt{display:flex;align-items:center;gap:8px;min-height:44px;border:1px solid #d0d7de;border-radius:8px;padding:0 14px;cursor:pointer;transition:border-color .2s,background .2s}
    .acu label.opt:has(:checked){border-color:#7d6a3a;background:#f6f1e4}
    .acu label.opt:has(:focus-visible){outline:2px solid #7d6a3a;outline-offset:2px}
    .acu .drop{display:flex;flex-direction:column;gap:6px;padding:16px;border:2px dashed #8c959f;border-radius:8px;cursor:pointer}
    .acu .drop small{color:#57606a}
    .acu progress{width:100%;height:8px;accent-color:#7d6a3a}
    .acu .msg{margin:0;min-height:1.5em;font-size:14px}
    .acu .msg.err{color:#cf222e}
    .acu .row{display:flex;justify-content:flex-end;gap:8px}
    .acu button{font:inherit;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #d0d7de;background:#fff;cursor:pointer}
    .acu button[type=submit]{background:#7d6a3a;border-color:#7d6a3a;color:#fff;font-weight:600}
    .acu button:focus-visible{outline:2px solid #7d6a3a;outline-offset:2px}
    .acu button:disabled{opacity:.6;cursor:wait}`;

  const radios = (name, options, selected) =>
    options
      .map(([value, label]) =>
        `<label class="opt"><input type="radio" name="${name}" value="${value}"${value === selected ? " checked" : ""} required>${label}</label>`)
      .join("");

  /**
   * Upload dialog. Resolves with [{ url, target, kind }] for every uploaded
   * file (empty array when cancelled).
   */
  function openDialog({ folder: fixedFolder = "", target = "gallery", multiple = false } = {}) {
    return new Promise((resolve) => {
      const results = [];
      const dialog = document.createElement("dialog");
      dialog.className = "acu";
      dialog.innerHTML = `
        <style>${css}</style>
        <form method="dialog">
          <h2>Nahrát ${multiple ? "soubory" : "soubor"}</h2>
          ${fixedFolder ? `<p class="msg">Uloží se do složky <strong>${fixedFolder}</strong>.</p>` : `
            <fieldset><legend>Kde se zobrazí</legend>${radios("target", TARGETS, target)}</fieldset>
            <fieldset><legend>Co nahráváte</legend>${radios("kind", KINDS, "images")}</fieldset>`}
          <label class="drop">
            <span><strong>Vyberte ${multiple ? "soubory" : "soubor"}</strong></span>
            <input type="file" name="file" ${multiple ? "multiple" : ""} required>
            <small>Fotky JPG/PNG/WebP, videa MP4. 360° panorama musí mít poměr 2:1.</small>
          </label>
          <progress value="0" max="1" hidden></progress>
          <p class="msg" role="status" aria-live="polite"></p>
          <div class="row">
            <button type="button" value="cancel">Zavřít</button>
            <button type="submit">Nahrát</button>
          </div>
        </form>`;
      document.body.append(dialog);

      const form = dialog.querySelector("form");
      const fileInput = form.elements.file;
      const progress = dialog.querySelector("progress");
      const msg = dialog.querySelector(".msg[role=status]");
      const submit = form.querySelector("button[type=submit]");
      const close = () => { dialog.close(); dialog.remove(); resolve(results); };

      dialog.querySelector("button[value=cancel]").addEventListener("click", close);
      dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });

      // Video files pick "Video" automatically.
      fileInput.addEventListener("change", () => {
        const files = [...(fileInput.files || [])];
        if (files.length && files.every((f) => f.type.startsWith("video/")) && form.elements.kind) {
          form.elements.kind.value = "videos";
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const files = [...(fileInput.files || [])];
        if (!files.length) return;
        const chosenTarget = form.elements.target?.value || target;
        const kindChoice = form.elements.kind?.value || "images";

        submit.disabled = true;
        progress.hidden = false;
        msg.className = "msg";
        try {
          for (const [i, file] of files.entries()) {
            const kind = file.type.startsWith("video/") ? "videos" : kindChoice;
            const folder = fixedFolder ||
              `AnewStyle/${chosenTarget === "bonus" ? "Bonus" : "Gallery"}/${kind}`;
            const label = files.length > 1 ? `${i + 1} / ${files.length}: ` : "";
            msg.textContent = `${label}připravuji…`;
            const sig = await api({ action: "sign", folder });
            const result = await upload(file, sig, (p) => {
              progress.value = p;
              msg.textContent = `${label}nahrávám ${file.name} – ${Math.round(p * 100)} %`;
            });
            results.push({ url: result.secure_url, target: chosenTarget, kind });
          }
          msg.textContent = files.length > 1 ? `Nahráno ${files.length} souborů.` : "Nahráno.";
          setTimeout(close, 700);
        } catch (error) {
          msg.className = "msg err";
          msg.textContent = `Chyba: ${error.message}`;
          submit.disabled = false;
        }
      });

      dialog.showModal();
    });
  }

  window.AnewCloudinary = { api, upload, parse, thumbOf, openDialog };

  // Media library for the remaining image/file fields (products).
  window.CMS.registerMediaLibrary({
    name: "anewstyle-cloudinary",
    init: ({ handleInsert }) => ({
      show: async ({ config = {} } = {}) => {
        const [first] = await openDialog({ folder: config.folder?.path || config.folder || "" , target: config.target });
        if (first) handleInsert(first.url);
      },
      hide: () => {},
      enableStandalone: () => false,
    }),
  });
})();
