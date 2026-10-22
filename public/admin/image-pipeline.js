/**
 * Image pipeline for Decap CMS – photos and 360° panoramas are watermarked
 * and compressed in the editor's browser, no image service or server.
 *
 *   ImagePipeline.process(file, { kind: "photo" | "360", onProgress }) →
 *     { width, height, focus: { x, y }, files: [{ width, blob }] }
 *
 * Rules (widths, quality, watermark placement) come from
 * src/lib/image-pipeline.ts via pipeline-core.js, the same module
 * scripts/image-set.ts uses. Encoding runs in a small pool of module workers
 * (image-worker.js), one photo per worker. The focus point is the centre of
 * smartcrop's best crop in the gallery tile shape (16:9, or 9:16 for portrait
 * photos), measured before the mark is drawn.
 *
 * Adapted from the Crystal Interiors CMS.
 */
(() => {
  const SCRIPT = document.currentScript?.src || location.href;
  const WORKER_URL = new URL("image-worker.js", SCRIPT).href;
  const POOL = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  // Panoramas decode to ~50 MP; one at a time keeps memory in check.
  const PANO_POOL = 1;

  const idle = [];
  const waiting = [];
  let created = 0;
  let nextId = 0;
  let panoBusy = 0;
  const panoWaiting = [];

  const getWorker = () =>
    new Promise((resolve) => {
      if (idle.length) return resolve(idle.pop());
      if (created < POOL) {
        created += 1;
        return resolve(new Worker(WORKER_URL, { type: "module" }));
      }
      waiting.push(resolve);
    });

  const release = (worker) => {
    const next = waiting.shift();
    next ? next(worker) : idle.push(worker);
  };

  const panoSlot = () =>
    new Promise((resolve) => (panoBusy < PANO_POOL ? (panoBusy += 1, resolve()) : panoWaiting.push(resolve)));
  const panoDone = () => {
    const next = panoWaiting.shift();
    next ? next() : (panoBusy -= 1);
  };

  function encodeInWorker(file, kind, onProgress) {
    return getWorker().then(
      (worker) =>
        new Promise((resolve, reject) => {
          const id = (nextId += 1);
          const onMessage = ({ data }) => {
            if (data.id !== id) return;
            if (data.type === "progress") return onProgress?.(data.done / data.total);
            worker.removeEventListener("message", onMessage);
            worker.removeEventListener("error", onError);
            release(worker);
            data.type === "done" ? resolve(data) : reject(new Error(data.message));
          };
          const onError = (event) => {
            worker.removeEventListener("message", onMessage);
            worker.removeEventListener("error", onError);
            worker.terminate();
            created -= 1;
            reject(new Error(event.message || "Zpracování fotky selhalo."));
          };
          worker.addEventListener("message", onMessage);
          worker.addEventListener("error", onError);
          worker.postMessage({ id, file, kind });
        }),
    );
  }

  /** Focus point (percent) from a small preview, via smartcrop (tile shape). */
  async function focusOf(preview, kind) {
    if (kind === "360") return { x: 50, y: 50 };
    try {
      const canvas = document.createElement("canvas");
      canvas.width = preview.width;
      canvas.height = preview.height;
      canvas.getContext("2d").putImageData(preview, 0, 0);
      const ratio = preview.height > preview.width ? 9 / 16 : 16 / 9;
      const side = Math.min(preview.width, preview.height * ratio);
      const { topCrop } = await window.smartcrop.crop(canvas, { width: side, height: side / ratio });
      return {
        x: Math.round(((topCrop.x + topCrop.width / 2) / preview.width) * 100),
        y: Math.round(((topCrop.y + topCrop.height / 2) / preview.height) * 100),
      };
    } catch {
      return { x: 50, y: 50 };
    }
  }

  async function process(file, { kind = "photo", onProgress } = {}) {
    let result;
    if (kind === "360") await panoSlot();
    try {
      result = await encodeInWorker(file, kind, onProgress);
    } catch (error) {
      const small = /^too-small:(\d+):(\d+)/.exec(error.message);
      if (small) {
        throw new Error(`Fotka je příliš malá (${small[1]} px na šířku). Nahrajte alespoň ${small[2]} px.`);
      }
      if (/^not-2-1:/.test(error.message)) {
        throw new Error("360° panorama musí mít poměr stran 2 : 1 (např. 8000 × 4000 px).");
      }
      if (/memory|allocation/i.test(error.message)) {
        throw new Error(`Na „${file.name}“ nestačí paměť prohlížeče. Zkuste to na počítači, ne na telefonu.`);
      }
      if (/decode|source image|InvalidState|EncodingError/i.test(error.message)) {
        throw new Error(`Soubor „${file.name}“ se nepodařilo otevřít. Použijte JPG, PNG nebo WebP (HEIC z iPhonu převeďte na JPG).`);
      }
      throw error;
    } finally {
      if (kind === "360") panoDone();
    }
    onProgress?.(1);
    return {
      width: result.width,
      height: result.height,
      focus: await focusOf(result.preview, kind),
      files: result.files.map(({ width, buffer }) => ({ width, blob: new Blob([buffer], { type: "image/avif" }) })),
    };
  }

  window.ImagePipeline = { process };
})();
