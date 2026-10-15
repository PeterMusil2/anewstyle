/**
 * Feedback after "Publikovat": a status panel that follows the website
 * rebuild until the change is live.
 *
 * Decap fires "postPublish" once the change is merged into master; Cloudflare
 * then builds the site (≈2–3 min). We poll /build.json until its builtAt is
 * newer than the publish time. Pending state survives a page reload.
 */
(() => {
  const KEY = "anewstyle-publish-pending";
  const POLL_MS = 15000;
  const GIVE_UP_MS = 12 * 60 * 1000;
  let timer = null;

  const css = `
    .ps{position:fixed;right:20px;bottom:20px;z-index:10000;width:min(24rem,calc(100vw - 40px));display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:10px;background:#1f2328;color:#fff;font:14px/1.5 system-ui,sans-serif;box-shadow:0 16px 40px rgb(0 0 0/.3)}
    .ps[data-state=done]{background:#1a7f37}
    .ps[data-state=error]{background:#cf222e}
    .ps strong{display:block;font-size:15px}
    .ps a{color:#fff;font-weight:600}
    .ps .spin{flex:none;width:20px;height:20px;margin-top:2px;border:3px solid rgb(255 255 255/.3);border-top-color:#fff;border-radius:50%;animation:ps-spin .9s linear infinite}
    .ps[data-state=done] .spin,.ps[data-state=error] .spin{display:none}
    .ps button{margin-left:auto;flex:none;width:32px;height:32px;border:0;border-radius:6px;background:rgb(255 255 255/.15);color:#fff;font-size:18px;line-height:1;cursor:pointer}
    .ps button:focus-visible{outline:2px solid #fff;outline-offset:2px}
    .ps progress{display:block;width:100%;height:4px;margin-top:8px;accent-color:#fff}
    @keyframes ps-spin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.ps .spin{animation:none}}`;

  function panel() {
    let el = document.getElementById("publish-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "publish-status";
      el.className = "ps";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.innerHTML = `<style>${css}</style><span class="spin" aria-hidden="true"></span><div class="ps-text"></div><button type="button" aria-label="Zavřít">×</button>`;
      el.querySelector("button").addEventListener("click", () => {
        el.remove();
      });
      document.body.append(el);
    }
    return el;
  }

  function show(state, title, text) {
    const el = panel();
    el.dataset.state = state;
    el.querySelector(".ps-text").innerHTML = `<strong>${title}</strong>${text}`;
  }

  async function check() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch {}
    if (!pending) return;

    const elapsed = Date.now() - pending.at;
    try {
      const res = await fetch(`/build.json?t=${Date.now()}`, { cache: "no-store" });
      const build = await res.json();
      if (Date.parse(build.builtAt) > pending.at) {
        sessionStorage.removeItem(KEY);
        show("done", "Hotovo – změny jsou na webu.", `<a href="${pending.url}" target="_blank" rel="noopener">Zobrazit na webu</a>`);
        return;
      }
    } catch {}

    if (elapsed > GIVE_UP_MS) {
      sessionStorage.removeItem(KEY);
      show("error", "Web se zatím neaktualizoval.", "Sestavení trvá déle než obvykle. Zkuste stránku obnovit za pár minut, případně se podívejte do Cloudflare → Deployments.");
      return;
    }

    const min = Math.floor(elapsed / 60000);
    const sec = Math.floor((elapsed % 60000) / 1000);
    show("busy", "Publikováno – web se aktualizuje…", `Obvykle to trvá 2–3 minuty. Uplynulo ${min}:${String(sec).padStart(2, "0")}.<br>Můžete pokračovat v práci.<progress max="180" value="${Math.min(180, elapsed / 1000)}"></progress>`);
    timer = setTimeout(check, elapsed < 60000 ? POLL_MS : POLL_MS / 1.5);
  }

  // Where to send the editor once it is live.
  const urlFor = (collection) =>
    ({ gallery: "/gallery/", prices: "/#price-list", faq: "/#faq", products: "/#products" })[collection] || "/";

  window.CMS.registerEventListener({
    name: "postPublish",
    handler: ({ entry }) => {
      const collection = entry?.get?.("collection") || "";
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), url: urlFor(collection) }));
      clearTimeout(timer);
      check();
    },
  });

  // Resume after a reload.
  check();
})();
