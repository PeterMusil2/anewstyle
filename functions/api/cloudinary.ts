/**
 * Cloudinary uploads for the CMS without a Cloudinary login
 * (Cloudflare Pages Function).
 *
 * POST /api/cloudinary  { action: "sign", folder }
 *   → { cloudName, apiKey, timestamp, signature, folder }
 *   The browser then uploads the file straight to Cloudinary with these
 *   values, so large videos never pass through this function.
 *
 * POST /api/cloudinary  { action: "rebuild" }
 *   → triggers the Pages deploy hook so the gallery picks the upload up.
 *
 * Every call must carry the editor's GitHub token from the Decap login
 * (`Authorization: Bearer <token>`). The token is accepted only when it has
 * push access to the site repository - the same people who can publish in
 * the CMS. Uploads are limited to the folders in ALLOWED_FOLDERS.
 *
 * Environment (Pages → Settings → Variables and Secrets):
 *   CLOUDINARY_URL   – cloudinary://API_KEY:API_SECRET@CLOUD_NAME (already set)
 *   DEPLOY_HOOK_URL  – optional; Pages deploy hook URL for "rebuild"
 */
interface Env {
  CLOUDINARY_URL?: string;
  DEPLOY_HOOK_URL?: string;
}

interface Context {
  request: Request;
  env: Env;
}

const REPO = "PeterMusil2/anewstyle";

const ALLOWED_FOLDERS = new Set([
  "AnewStyle/Gallery/images",
  "AnewStyle/Gallery/videos",
  "AnewStyle/Gallery/360",
  "AnewStyle/Bonus/images",
  "AnewStyle/Bonus/videos",
  "AnewStyle/Bonus/360",
  "AnewStyle/Products",
  "AnewStyle/Products/3D",
  "AnewStyle/Products/Downloads",
]);

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Parse cloudinary://key:secret@cloud. */
function parseCloudinaryUrl(value = "") {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(value.trim());
  return match ? { apiKey: match[1], apiSecret: match[2], cloudName: match[3] } : null;
}

/** True when the GitHub token belongs to someone who can push to the repo. */
async function canPublish(request: Request): Promise<boolean> {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return false;
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "anewstyle-cms",
    },
  });
  if (!res.ok) return false;
  const repo = (await res.json()) as { permissions?: { push?: boolean } };
  return repo.permissions?.push === true;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost = async ({ request, env }: Context): Promise<Response> => {
  if (!(await canPublish(request))) {
    return json({ error: "Přihlaste se do CMS účtem s přístupem k webu." }, 401);
  }

  let body: { action?: string; folder?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  if (body.action === "rebuild") {
    if (!env.DEPLOY_HOOK_URL) return json({ rebuilt: false });
    const hook = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
    return json({ rebuilt: hook.ok });
  }

  if (body.action !== "sign") return json({ error: "Unknown action." }, 400);

  const folder = body.folder ?? "";
  if (!ALLOWED_FOLDERS.has(folder)) return json({ error: "Folder not allowed." }, 400);

  const creds = parseCloudinaryUrl(env.CLOUDINARY_URL);
  if (!creds) return json({ error: "CLOUDINARY_URL is not configured." }, 500);

  // Cloudinary signs the alphabetically sorted params followed by the secret.
  // use_filename keeps a readable public_id ("living-room_x7k2"), which the
  // gallery build also turns into the default caption.
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=${folder}&timestamp=${timestamp}&unique_filename=true&use_filename=true`;
  const signature = await sha1Hex(params + creds.apiSecret);

  return json({
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    timestamp,
    signature,
    folder,
  });
};
