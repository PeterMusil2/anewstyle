/**
 * Repo store for Decap CMS – writes binary files straight into the site's
 * repository, so photos live in git next to the content (no media service).
 *
 *   RepoStore.commit([{ path: "public/media/images/x-800.avif", blob }], message)
 *
 * - GitHub backend: one commit for the whole batch through the Git Data API,
 *   with the editor's own CMS login token. The message ends with [skip ci],
 *   so uploads do not trigger a deploy; the files go live with the next
 *   publish (they are unreferenced until then).
 * - Local backend (`bun run cms:local`): files are written through
 *   decap-server, like any other Decap media upload.
 *
 * Repo and branch come from config.yml (backend.repo / backend.branch).
 * Project-agnostic: reuse it in other Decap sites as is.
 */
(() => {
  const API = "https://api.github.com";
  const LOCAL = "http://localhost:8081/api/v1";
  const CONFIG_URL = new URL("config.yml", document.currentScript?.src || location.href).href;

  let configPromise;
  const config = () =>
    (configPromise ??= fetch(CONFIG_URL)
      .then((res) => res.text())
      .then((yaml) => {
        const backend = /^backend:\s*\n((?:[ \t]+.*\n?)*)/m.exec(yaml)?.[1] || "";
        const value = (key) => new RegExp(`^\\s+${key}:\\s*["']?([^"'\\s#]+)`, "m").exec(backend)?.[1];
        return { repo: value("repo"), branch: value("branch") || "main", local: /^local_backend:\s*true/m.test(yaml) };
      }));

  const token = () => {
    for (const key of ["decap-cms-user", "netlify-cms-user"]) {
      try {
        const user = JSON.parse(localStorage.getItem(key) || "null");
        if (user?.token) return user.token;
      } catch {}
    }
    return "";
  };

  const isLocalHost = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  let localPromise;
  const useLocal = async () => {
    if (!isLocalHost() || !(await config()).local) return false;
    return (localPromise ??= fetch(LOCAL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "info" }),
    })
      .then((res) => res.ok)
      .catch(() => false));
  };

  const toBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  async function github(path, init = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || `GitHub HTTP ${res.status}`), { status: res.status });
    return data;
  }

  async function commitToGitHub(files, message, onProgress) {
    const { repo, branch } = await config();
    if (!token()) throw new Error("Nejste přihlášeni – obnovte stránku a přihlaste se znovu.");

    const blobs = [];
    for (const [i, file] of files.entries()) {
      const { sha } = await github(`/repos/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: await toBase64(file.blob), encoding: "base64" }),
      });
      blobs.push({ path: file.path, mode: "100644", type: "blob", sha });
      onProgress?.((i + 1) / files.length);
    }

    // Decap may commit to the same branch meanwhile: retry on a moved head.
    for (let attempt = 1; ; attempt += 1) {
      const ref = await github(`/repos/${repo}/git/ref/heads/${branch}`);
      const head = await github(`/repos/${repo}/git/commits/${ref.object.sha}`);
      const tree = await github(`/repos/${repo}/git/trees`, {
        method: "POST",
        body: JSON.stringify({ base_tree: head.tree.sha, tree: blobs }),
      });
      const commit = await github(`/repos/${repo}/git/commits`, {
        method: "POST",
        body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
      });
      try {
        await github(`/repos/${repo}/git/refs/heads/${branch}`, {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha }),
        });
        return;
      } catch (error) {
        if (error.status !== 422 || attempt >= 3) throw error;
      }
    }
  }

  async function commitLocally(files, message, onProgress) {
    const { branch } = await config();
    for (const [i, file] of files.entries()) {
      const res = await fetch(LOCAL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "persistMedia",
          params: {
            branch,
            asset: { path: file.path, content: await toBase64(file.blob), encoding: "base64" },
            options: { commitMessage: message },
          },
        }),
      });
      if (!res.ok) throw new Error(`Uložení ${file.path} selhalo (HTTP ${res.status}).`);
      onProgress?.((i + 1) / files.length);
    }
  }

  async function commit(files, message, { onProgress } = {}) {
    if (!files.length) return;
    const text = /\[skip ci\]/i.test(message) ? message : `${message} [skip ci]`;
    return (await useLocal()) ? commitLocally(files, text, onProgress) : commitToGitHub(files, text, onProgress);
  }

  /**
   * Public URL of a file under public/: the live site first; files committed
   * but not deployed yet fall back to the raw file on GitHub (public repos).
   */
  async function fallbackUrl(path) {
    const { repo, branch } = await config();
    return (await useLocal()) ? "" : `https://raw.githubusercontent.com/${repo}/${branch}/public${path}`;
  }

  window.RepoStore = { config, commit, fallbackUrl };
})();
