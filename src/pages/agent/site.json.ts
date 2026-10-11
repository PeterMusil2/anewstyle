/**
 * Machine-readable site facts for AI agents (both languages). Prerendered at
 * build time; read by the /mcp server and the in-page WebMCP tools.
 */
import type { APIRoute } from "astro";
import { getSiteData } from "../../lib/site-data";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({ cs: getSiteData("cs"), en: getSiteData("en") }, null, 2),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
