/**
 * Gallery uploads for the ANEW STYLE CMS.
 *
 *  - Photos and 360° panoramas: watermarked and compressed in the browser
 *    (image-pipeline.js), then committed to the repository under
 *    public/media/<images|360>/ in one commit (repo-store.js). The gallery
 *    value stores only the base path `/media/<images|360>/<name>`; the
 *    website builds srcset from the files.
 *  - Videos: straight to Cloudinary, as before (cloudinary-upload.js).
 *
 * window.AnewMedia:
 *   openDialog({ target, multiple }) → [{ media, kind, target, focus?, width?, height? }]
 *   editFocus({ media, kind, focus }) → focus | null
 *   isSet(media), kindOfSet(media), thumb(media), large({ media, width }),
 *   onThumbError(event, media)
 */
(() => {
  const TARGETS = [["gallery", "Veřejná galerie"], ["bonus", "Bonus (po odeslání formuláře)"]];
  const KINDS = [["photo", "Fotka"], ["360", "360° panorama"], ["video", "Video"]];
  // Smallest and largest width per kind – src/lib/image-pipeline.ts (WIDTHS).
  const WIDTHS = { photo: [400, 1800], "360": [800, 4096] };

  const preview = new Map(); // media → object URL of this session's uploads

  const slugify = (value) =>
    String(value || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const rand = () => Math.random().toString(36).slice(2, 6);
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const isSet = (media) => /^\/media\/(images|360)\/[^.]+$/.test(media || "");
  const kindOfSet = (media) => (/^\/media\/360\//.test(media || "") ? "360" : "photo");
  const thumb = (media) => preview.get(media) || (isSet(media) ? `${media}-${WIDTHS[kindOfSet(media)][0]}.avif` : "");
  /** Largest file of a set: the original width, capped at the largest standard width. */
  const large = ({ media, width }) => {
    const max = WIDTHS[kindOfSet(media)][1];
    return `${media}-${width ? Math.min(width, max) : WIDTHS[kindOfSet(media)][0]}.avif`;
  };

  /** Not deployed yet → the raw file on GitHub (public repository). */
  async function onThumbError(event, media) {
    const img = event.currentTarget;
    if (!isSet(media) || img.dataset.fallback) return;
    img.dataset.fallback = "1";
    const url = await window.RepoStore.fallbackUrl(new URL(img.src, location.href).pathname);
    if (url) img.src = url;
  }

  const css = `
    .amu{border:0;padding:0;border-radius:10px;width:min(36rem,calc(100vw - 2rem));font:15px/1.5 system-ui,sans-serif;color:#1f2328;box-shadow:0 24px 64px rgb(0 0 0/.35)}
    .amu::backdrop{background:rgb(0 0 0/.5)}
    .amu form{display:flex;flex-direction:column;gap:18px;padding:24px}
    .amu h2{margin:0;font-size:19px}
    .amu fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
    .amu legend{font-weight:600;margin-bottom:6px}
    .amu label.opt{display:flex;align-items:center;gap:8px;min-height:44px;border:1px solid #d0d7de;border-radius:8px;padding:0 14px;cursor:pointer;transition:border-color .2s,background .2s}
    .amu label.opt:has(:checked){border-color:#7d6a3a;background:#f6f1e4}
    .amu label.opt:has(:focus-visible){outline:2px solid #7d6a3a;outline-offset:2px}
    .amu .drop{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 16px;border:2px dashed #8c959f;border-radius:8px;text-align:center;cursor:pointer;transition:border-color .2s,background .2s}
    .amu .drop.over,.amu .drop:hover{border-color:#7d6a3a;background:#f6f1e4}
    .amu .drop:focus-within{outline:2px solid #7d6a3a;outline-offset:2px}
    .amu .drop input{position:absolute;width:1px;height:1px;opacity:0}
    .amu .drop small{color:#57606a}
    .amu .files{margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:13px;max-height:13rem;overflow:auto}
    .amu .files li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}
    .amu .files progress{grid-column:1/-1;width:100%;height:6px;accent-color:#7d6a3a}
    .amu .files .state{color:#57606a}
    .amu .files .err{grid-column:1/-1;color:#cf222e}
    .amu .msg{margin:0;min-height:1.5em;font-size:14px}
    .amu .msg.err{color:#cf222e}
    .amu .row{display:flex;justify-content:flex-end;gap:8px}
    .amu button{font:inherit;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid #d0d7de;background:#fff;cursor:pointer}
    .amu button[type=submit]{background:#7d6a3a;border-color:#7d6a3a;color:#fff;font-weight:600}
    .amu button:focus-visible{outline:2px solid #7d6a3a;outline-offset:2px}
    .amu button:disabled{opacity:.6;cursor:wait}
    .amu .stage{position:relative;display:grid;place-items:center;background:#111;border-radius:8px;overflow:hidden;cursor:crosshair;touch-action:none}
    .amu .stage img{display:block;max-width:100%;max-height:min(55vh,28rem);user-select:none;-webkit-user-drag:none}
    .amu .dot{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px #7d6a3a,0 2px 8px rgb(0 0 0/.5);pointer-events:none}
    .amu .tile{width:12rem;border-radius:8px;overflow:hidden;background:#111}
    .amu .tile img{width:100%;height:100%;object-fit:cover;display:block}
    .amu .side{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
    .amu .side p{margin:0;flex:1;min-width:10rem;font-size:14px;color:#57606a}`;

  const radios = (name, options, selected) =>
    options
      .map(([value, label]) =>
        `<label class="opt"><input type="radio" name="${name}" value="${value}"${value === selected ? " checked" : ""} required>${label}</label>`)
      .join("");

  /** Photos/360 → watermark + AVIF + one commit. Resolves with gallery entries. */
  async function uploadSets(files, kind, target, row, msg) {
    const folder = kind === "360" ? "360" : "images";
    const processed = await Promise.all(
      files.map(async (file, i) => {
        const { state, bar, li } = row(i);
        state.textContent = "zpracovávám";
        try {
          const out = await window.ImagePipeline.process(file, { kind, onProgress: (p) => (bar.value = p * 0.9) });
          const media = `/media/${folder}/${slugify(file.name.replace(/\.\w+$/, "")) || "foto"}-${rand()}`;
          const kb = out.files.reduce((sum, f) => sum + f.blob.size, 0) / 1024;
          state.textContent = `${out.width} × ${out.height} px · ${kb.toFixed(0)} kB`;
          return { i, media, ...out };
        } catch (error) {
          bar.remove();
          state.textContent = "chyba";
          li.insertAdjacentHTML("beforeend", `<span class="err">${escapeHtml(error.message)}</span>`);
          return null;
        }
      }),
    );
    const ok = processed.filter(Boolean);
    if (!ok.length) return { entries: [], failed: files.length };

    msg.textContent = `Ukládám ${ok.length === 1 ? "1 soubor" : `${ok.length} souborů`} na web…`;
    const paths = ok.flatMap((item) => item.files.map((f) => ({ path: `public${item.media}-${f.width}.avif`, blob: f.blob })));
    await window.RepoStore.commit(paths, `content(media): ${ok.length} ${kind === "360" ? "panorama(s)" : "photo(s)"} → /media/${folder}`, {
      onProgress: (p) => ok.forEach((item) => { row(item.i).bar.value = 0.9 + p * 0.1; }),
    });
    const entries = ok.map((item) => {
      preview.set(item.media, URL.createObjectURL(item.files[0].blob));
      return { media: item.media, kind, target, focus: item.focus, width: item.width, height: item.height };
    });
    return { entries, failed: files.length - ok.length };
  }

  /** Videos → Cloudinary through the signed upload. */
  async function uploadVideos(files, target, row) {
    const entries = [];
    let failed = 0;
    for (const [i, file] of files.entries()) {
      const { state, bar, li } = row(i);
      try {
        state.textContent = "nahrávám";
        const folder = `AnewStyle/${target === "bonus" ? "Bonus" : "Gallery"}/videos`;
        const sig = await window.AnewCloudinary.api({ action: "sign", folder });
        const result = await window.AnewCloudinary.upload(file, sig, (p) => (bar.value = p));
        state.textContent = "hotovo";
        entries.push({ media: result.secure_url, kind: "video", target });
      } catch (error) {
        failed += 1;
        state.textContent = "chyba";
        li.insertAdjacentHTML("beforeend", `<span class="err">${escapeHtml(error.message)}</span>`);
      }
    }
    return { entries, failed };
  }

  function openDialog({ target = "gallery", multiple = true } = {}) {
    return new Promise((resolve) => {
      const results = [];
      const dialog = document.createElement("dialog");
      dialog.className = "amu";
      dialog.setAttribute("aria-labelledby", "amu-title");
      dialog.innerHTML = `
        <style>${css}</style>
        <form method="dialog">
          <h2 id="amu-title">Nahrát do galerie</h2>
          <fieldset><legend>Kde se zobrazí</legend>${radios("target", TARGETS, target)}</fieldset>
          <fieldset><legend>Co nahráváte</legend>${radios("kind", KINDS, "photo")}</fieldset>
          <label class="drop">
            <strong>Přetáhněte soubory sem</strong>
            <span>nebo klikněte a vyberte z počítače</span>
            <input type="file" name="file" ${multiple ? "multiple" : ""} required>
            <small class="hint"></small>
          </label>
          <ul class="files" aria-label="Vybrané soubory"></ul>
          <p class="msg" role="status" aria-live="polite"></p>
          <div class="row">
            <button type="button" value="cancel">Zavřít</button>
            <button type="submit">Nahrát</button>
          </div>
        </form>`;
      document.body.append(dialog);

      const form = dialog.querySelector("form");
      const drop = dialog.querySelector(".drop");
      const input = form.elements.file;
      const hint = dialog.querySelector(".hint");
      const list = dialog.querySelector(".files");
      const msg = dialog.querySelector(".msg");
      const submit = form.querySelector("button[type=submit]");
      let picked = [];
      let busy = false;

      const HINTS = {
        photo: "JPG, PNG nebo WebP, ideálně aspoň 1800 px na šířku. Vodoznak se přidá automaticky, fotky zmenšíme a zkomprimujeme přímo v prohlížeči.",
        "360": "Panorama JPG v poměru 2 : 1, ideálně 4096 px a víc. Vodoznak se přidá automaticky. Zpracování chvilku trvá – nahrávejte z počítače.",
        video: "MP4. Video se nahraje do Cloudinary.",
      };
      const ACCEPT = { photo: "image/jpeg,image/png,image/webp,image/avif", "360": "image/jpeg,image/png,image/webp,image/avif", video: "video/*" };
      const kind = () => form.elements.kind.value;
      const syncKind = () => {
        hint.textContent = HINTS[kind()];
        input.accept = ACCEPT[kind()];
      };
      syncKind();
      form.addEventListener("change", (e) => e.target.name === "kind" && syncKind());

      const close = () => {
        if (busy) return;
        dialog.close();
        dialog.remove();
        resolve(results);
      };
      const show = (files) => {
        // Picking only videos switches the kind to "Video" automatically.
        if (files.length && files.every((f) => f.type.startsWith("video/"))) {
          form.elements.kind.value = "video";
          syncKind();
        }
        const wanted = kind() === "video" ? "video/" : "image/";
        picked = files.filter((f) => f.type.startsWith(wanted));
        if (!multiple) picked = picked.slice(0, 1);
        list.innerHTML = picked
          .map((f, i) => `<li data-i="${i}"><span>${escapeHtml(f.name)} · ${(f.size / 1048576).toFixed(1)} MB</span><span class="state">čeká</span><progress value="0" max="1"></progress></li>`)
          .join("");
        msg.className = "msg";
        msg.textContent = picked.length ? `Vybráno: ${picked.length}` : files.length ? "Tyto soubory neodpovídají volbě „Co nahráváte“." : "";
      };
      const row = (i) => {
        const li = list.querySelector(`li[data-i="${i}"]`);
        return { li, state: li.querySelector(".state"), bar: li.querySelector("progress") || document.createElement("progress") };
      };

      dialog.querySelector("button[value=cancel]").addEventListener("click", close);
      dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
      input.addEventListener("change", () => show([...(input.files || [])]));
      ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add("over"); }));
      ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, () => drop.classList.remove("over")));
      drop.addEventListener("drop", (e) => { e.preventDefault(); show([...(e.dataTransfer?.files || [])]); });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!picked.length) { msg.className = "msg err"; msg.textContent = "Nejdřív vyberte soubory."; return; }
        busy = true;
        submit.disabled = true;
        msg.className = "msg";
        const chosen = kind();
        const where = form.elements.target.value;
        try {
          msg.textContent = chosen === "video" ? "Nahrávám videa…" : "Přidávám vodoznak, zmenšuji a komprimuji…";
          const { entries, failed } = chosen === "video"
            ? await uploadVideos(picked, where, row)
            : await uploadSets(picked, chosen, where, row, msg);
          results.push(...entries);
          busy = false;
          if (!entries.length) {
            submit.disabled = false;
            msg.className = "msg err";
            msg.textContent = "Žádný soubor se nepodařilo nahrát.";
            return;
          }
          msg.textContent = `Hotovo – nahráno ${entries.length}${failed ? `, ${failed} se nepodařilo` : ""}. Na webu se objeví po publikování.`;
          setTimeout(close, failed ? 2500 : 900);
        } catch (error) {
          busy = false;
          submit.disabled = false;
          msg.className = "msg err";
          msg.textContent = `Uložení selhalo: ${error.message}`;
        }
      });

      dialog.showModal();
    });
  }

  /** Click (or drag) on the full photo to set what stays in the tile. */
  function editFocus({ media, width, height, focus = { x: 50, y: 50 } }) {
    return new Promise((resolve) => {
      let current = { ...focus };
      const portrait = height > width;
      const dialog = document.createElement("dialog");
      dialog.className = "amu";
      dialog.setAttribute("aria-labelledby", "amu-focus-title");
      dialog.innerHTML = `
        <style>${css}</style>
        <form method="dialog">
          <h2 id="amu-focus-title">Co má být vidět v náhledu</h2>
          <div class="stage"><img alt="Celá fotka" draggable="false"><span class="dot"></span></div>
          <div class="side">
            <div class="tile" style="aspect-ratio:${portrait ? "9/16;width:7rem" : "16/9"}"><img alt="Náhled dlaždice na webu"></div>
            <p>Klikněte na to nejdůležitější na fotce. Dlaždice v galerii fotku ořízne na ${portrait ? "9 : 16" : "16 : 9"} a tohle místo nechá vidět. Ve zvětšení je fotka vždy celá.</p>
          </div>
          <div class="row">
            <button type="button" value="reset">Na střed</button>
            <button type="button" value="cancel">Zrušit</button>
            <button type="submit">Použít</button>
          </div>
        </form>`;
      document.body.append(dialog);
      const stage = dialog.querySelector(".stage");
      const full = stage.querySelector("img");
      const dot = stage.querySelector(".dot");
      const tile = dialog.querySelector(".tile img");
      for (const img of [full, tile]) {
        img.addEventListener("error", (e) => onThumbError(e, media));
        img.src = preview.get(media) || (img === tile ? thumb(media) : large({ media, width }));
      }

      const paint = () => {
        const box = full.getBoundingClientRect();
        const host = stage.getBoundingClientRect();
        dot.style.left = `${box.left - host.left + (box.width * current.x) / 100}px`;
        dot.style.top = `${box.top - host.top + (box.height * current.y) / 100}px`;
        tile.style.objectPosition = `${current.x}% ${current.y}%`;
      };
      const set = (event) => {
        const box = full.getBoundingClientRect();
        current = {
          x: Math.round(Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100))),
          y: Math.round(Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100))),
        };
        paint();
      };
      let dragging = false;
      stage.addEventListener("pointerdown", (e) => { dragging = true; stage.setPointerCapture(e.pointerId); set(e); });
      stage.addEventListener("pointermove", (e) => dragging && set(e));
      stage.addEventListener("pointerup", () => (dragging = false));
      full.addEventListener("load", paint);

      const finish = (value) => { dialog.close(); dialog.remove(); resolve(value); };
      dialog.querySelector("button[value=cancel]").addEventListener("click", () => finish(null));
      dialog.querySelector("button[value=reset]").addEventListener("click", () => { current = { x: 50, y: 50 }; paint(); });
      dialog.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
      dialog.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); finish(current); });
      dialog.showModal();
      paint();
    });
  }

  window.AnewMedia = { openDialog, editFocus, isSet, kindOfSet, thumb, large, onThumbError };
})();
