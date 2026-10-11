/**
 * Decap CMS – step 2 of the GitHub OAuth flow (Cloudflare Pages Function).
 *
 * GET /api/callback?code=…&state=… → exchanges the code for an access token
 * and hands it to the Decap window that opened the popup, using Decap's
 * `authorization:github:<status>:<json>` postMessage handshake. The token is
 * only ever posted to this site's own origin.
 */
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

interface Context {
  request: Request;
  env: Env;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const STATE_COOKIE = "decap_oauth_state";

const readCookie = (request: Request, name: string): string | undefined =>
  request.headers
    .get("Cookie")
    ?.split(/;\s*/)
    .map((pair) => pair.split("="))
    .find(([key]) => key === name)?.[1];

/** HTML page that completes Decap's popup handshake. */
const handshake = (
  origin: string,
  status: "success" | "error",
  content: Record<string, string>,
): Response => {
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  // Inline-script safe JSON: no "</script>" can break out of the tag.
  const js = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="cs">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Přihlášení…</title></head>
<body>
<script>
(() => {
  const origin = ${js(origin)};
  const message = ${js(message)};
  const receive = (event) => {
    if (event.origin !== origin) return;
    window.opener.postMessage(message, origin);
    window.removeEventListener("message", receive);
  };
  window.addEventListener("message", receive);
  window.opener?.postMessage("authorizing:github", origin);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: status === "success" ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${STATE_COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
};

export const onRequestGet = async ({ request, env }: Context): Promise<Response> => {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || state !== readCookie(request, STATE_COOKIE)) {
    return handshake(origin, "error", { message: "Invalid OAuth state." });
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "anewstyle-decap-cms",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    });
    const data = (await response.json()) as TokenResponse;

    if (!data.access_token) {
      return handshake(origin, "error", {
        message: data.error_description ?? data.error ?? "GitHub did not return a token.",
      });
    }

    return handshake(origin, "success", { token: data.access_token, provider: "github" });
  } catch {
    return handshake(origin, "error", { message: "Could not reach GitHub." });
  }
};
