/**
 * Decap CMS media library: upload straight to Cloudinary without a
 * Cloudinary account.
 *
 * The editor picks where the file goes (gallery or bonus) and what it is
 * (photo, video, 360° panorama); /api/cloudinary checks their CMS GitHub
 * login and signs the upload, then the file goes directly from the browser to
 * Cloudinary. Afterwards the site is rebuilt so it shows up in the gallery.
 *
 * Field config (config.yml → media_library.config):
 *   target: gallery | bonus     preselects the destination
 *   folder: { path: "…" }       fixed folder, no choice shown (products)
 */
(() => {
  const TARGETS = { gallery: "Galerie (veřejná)", bonus: "Bonus (po odeslání formuláře)" };
  const KINDS = { images: "Fotka", videos: "Video", 360: "360° panorama" };

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
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText || "{}");
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error?.message || `HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("Nahrávání selhalo (síť)."));
      xhr.send(form);
    });

  const css = `
    .acu{border:0;padding:0;border-radius:8px;width:min(32rem,calc(100vw - 2rem));font:15px/1.5 system-ui,sans-serif;color:#1f2328;box-shadow:0 20px 60px rgb(0 0 0/.35)}
    .acu::backdrop{background:rgb(0 0 0/.5)}
    .acu form{display:flex;flex-direction:column;gap:16px;padding:24px}
    .acu h2{margin:0;font-size:18px}
    .acu fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
    .acu legend{font-weight:600;margin-bottom:6px}
    .acu label.opt{display:flex;align-items:center;gap:6px;border:1px solid #d0d7de;border-radius:6px;padding:8px 12px;cursor:pointer}
    .acu label.opt:has(:checked){border-color:#a38c52;background:#f6f1e4}
    .acu input[type=file]{padding:12px;border:1px dashed #8c959f;border-radius:6px}
    .acu progress{width:100%;height:8px}
    .acu .msg{margin:0;min-height:1.5em;font-size:14px}
    .acu .msg.err{color:#cf222e}
    .acu .row{display:flex;justify-content:flex-end;gap:8px}
    .acu button{font:inherit;padding:8px 16px;border-radius:6px;border:1px solid #d0d7de;background:#fff;cursor:pointer}
    .acu button[type=submit]{background:#7d6a3a;border-color:#7d6a3a;color:#fff;font-weight:600}
    .acu button:disabled{opacity:.6;cursor:wait}`;

  const radios = (name, options, selected) =>
    Object.entries(options)
      .map(([value, label]) =>
        `<label class="opt"><input type="radio" name="${name}" value="${value}"${value === selected ? " checked" : ""} required>${label}</label>`)
      .join("");

  function openDialog({ config = {}, handleInsert }) {
    const fixedFolder = config.folder?.path || config.folder || "";
    const target = TARGETS[config.target] ? config.target : "gallery";

    const dialog = document.createElement("dialog");
    dialog.className = "acu";
    dialog.innerHTML = `
      <style>${css}</style>
      <form method="dialog">
        <h2>Nahrát do Cloudinary</h2>
        ${fixedFolder ? `<p class="msg">Složka: <strong>${fixedFolder}</strong></p>` : `
          <fieldset><legend>Kam</legend>${radios("target", TARGETS, target)}</fieldset>
          <fieldset><legend>Typ</legend>${radios("kind", KINDS, "images")}</fieldset>`}
        <input type="file" name="file" required>
        <progress value="0" max="1" hidden></progress>
        <p class="msg" role="status"></p>
        <div class="row">
          <button type="button" value="cancel">Zrušit</button>
          <button type="submit">Nahrát</button>
        </div>
      </form>`;
    document.body.append(dialog);

    const form = dialog.querySelector("form");
    const fileInput = form.elements.file;
    const progress = dialog.querySelector("progress");
    const msg = dialog.querySelector(".msg[role=status]");
    const submit = form.querySelector("button[type=submit]");
    const close = () => { dialog.close(); dialog.remove(); };

    dialog.querySelector("button[value=cancel]").addEventListener("click", close);
    dialog.addEventListener("cancel", close);

    // A video file selects "Video" automatically.
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file?.type.startsWith("video/") && form.elements.kind) form.elements.kind.value = "videos";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = fileInput.files?.[0];
      if (!file) return;
      const folder = fixedFolder ||
        `AnewStyle/${form.elements.target.value === "bonus" ? "Bonus" : "Gallery"}/${form.elements.kind.value}`;

      submit.disabled = true;
      msg.className = "msg";
      msg.textContent = "Připravuji…";
      progress.hidden = false;
      try {
        const sig = await api({ action: "sign", folder });
        const result = await upload(file, sig, (p) => {
          progress.value = p;
          msg.textContent = `Nahrávám… ${Math.round(p * 100)} %`;
        });
        handleInsert(result.secure_url);
        msg.textContent = "Hotovo. Web se aktualizuje za 1–3 minuty.";
        api({ action: "rebuild" }).catch(() => {});
        setTimeout(close, 900);
      } catch (error) {
        msg.className = "msg err";
        msg.textContent = error.message;
        submit.disabled = false;
      }
    });

    dialog.showModal();
  }

  window.CMS.registerMediaLibrary({
    name: "anewstyle-cloudinary",
    init: ({ handleInsert }) => ({
      show: ({ config } = {}) => openDialog({ config, handleInsert }),
      hide: () => {},
      enableStandalone: () => false,
    }),
  });
})();
