/**
 * /build.json – when and from which commit the live site was built.
 * The CMS polls it after "Publikovat" to tell the editor when the change is
 * actually on the web (public/admin/publish-status.js).
 */
import type { APIRoute } from "astro";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      builtAt: new Date().toISOString(),
      commit: process.env.CF_PAGES_COMMIT_SHA ?? null,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
