/**
 * Decap CMS – step 1 of the GitHub OAuth flow (Cloudflare Pages Function).
 *
 * GET /api/auth → redirects to GitHub's consent screen. A random `state` is
 * stored in a short-lived, HttpOnly cookie and checked again in /api/callback.
 *
 * Environment (Pages → Settings → Variables and Secrets):
 *   GITHUB_CLIENT_ID      – OAuth app client ID
 *   GITHUB_CLIENT_SECRET  – OAuth app client secret (encrypted)
 */
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

interface Context {
  request: Request;
  env: Env;
}

const STATE_COOKIE = "decap_oauth_state";

export const onRequestGet = ({ request, env }: Context): Response => {
  if (!env.GITHUB_CLIENT_ID) {
    return new Response("GITHUB_CLIENT_ID is not configured.", { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/api/callback`);
  authorize.searchParams.set("scope", "repo,user");
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
};
