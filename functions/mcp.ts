/**
 * Read-only MCP server for AI agents (Cloudflare Pages Function).
 *
 *   POST /mcp   JSON-RPC 2.0, MCP "Streamable HTTP" transport, stateless,
 *               single JSON responses (no SSE needed for read-only tools).
 *
 * Tools serve the same facts as the pages, read from the prerendered
 * /agent/site.json. Nothing here can write or send anything.
 */
interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

interface Context {
  request: Request;
  env: Env;
}

type Lang = "cs" | "en";
type SiteData = Record<string, unknown> & {
  versions: { name: string; prices: { size: string }[] }[];
  faq: { question: string; answer: string; answerMineral?: string }[];
  patterns: unknown[];
  mineralPatterns: unknown[];
  mineralPatternsNote: string;
  mineralSurcharge: { size: string }[];
  panelCategories: unknown[];
  contact: unknown;
  currency: string;
  priceNote: string;
  customSizeNote: string;
  patternsNote: string;
};

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const SIZES = ["L", "XL", "XXL", "XXXL"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
};

const langProperty = {
  lang: { type: "string", enum: ["cs", "en"], default: "cs", description: "Answer language." },
};

const TOOLS = [
  {
    name: "get_price_list",
    title: "Price list",
    description:
      "Prices in CZK (excl. and incl. 21% VAT) of the ANEW STYLE illuminated stone and mineral panel versions SLIM, BASIC and DELUXE for sizes L–XXXL (mineral = stone price + per-size surcharge), plus the feature matrix.",
    inputSchema: {
      type: "object",
      properties: { ...langProperty, size: { type: "string", enum: SIZES } },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_stone_patterns",
    title: "Stone patterns",
    description: "Illustrative natural-stone patterns with photos and 3D models.",
    inputSchema: { type: "object", properties: { ...langProperty } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_mineral_patterns",
    title: "Mineral decors",
    description: "Mineral panel decors with photos (viewable in 3D and AR on the website).",
    inputSchema: { type: "object", properties: { ...langProperty } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "search_faq",
    title: "FAQ",
    description: "Frequently asked questions about installation, cables, humidity, repairs, control and weight; answerMineral where mineral panels differ.",
    inputSchema: { type: "object", properties: { ...langProperty, query: { type: "string" } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_contact",
    title: "Contact & showroom",
    description: "E-mail, phone, showroom address (by appointment), company IDs, e-shop and contact-form links.",
    inputSchema: { type: "object", properties: { ...langProperty } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const json = (body: unknown, status = 200): Response =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const rpcResult = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: JsonRpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function loadData(context: Context, lang: Lang): Promise<SiteData> {
  const url = new URL("/agent/site.json", context.request.url);
  const response = await context.env.ASSETS.fetch(url.toString());
  const all = (await response.json()) as Record<Lang, SiteData>;
  return all[lang] ?? all.cs;
}

async function callTool(context: Context, name: string, args: Record<string, unknown>) {
  const lang: Lang = args.lang === "en" ? "en" : "cs";
  const data = await loadData(context, lang);
  let payload: unknown;

  switch (name) {
    case "get_price_list": {
      const size = typeof args.size === "string" ? args.size.toUpperCase() : undefined;
      payload = {
        currency: data.currency,
        note: data.priceNote,
        customSize: data.customSizeNote,
        panelCategories: data.panelCategories,
        mineralSurcharge: size ? data.mineralSurcharge.filter((item) => item.size === size) : data.mineralSurcharge,
        versions: data.versions.map((version) => ({
          ...version,
          prices: size ? version.prices.filter((price) => price.size === size) : version.prices,
        })),
      };
      break;
    }
    case "list_stone_patterns":
      payload = { note: data.patternsNote, patterns: data.patterns };
      break;
    case "list_mineral_patterns":
      payload = { note: data.mineralPatternsNote, patterns: data.mineralPatterns };
      break;
    case "search_faq": {
      const query = typeof args.query === "string" ? args.query.toLowerCase().trim() : "";
      const hits = query
        ? data.faq.filter((item) => `${item.question} ${item.answer} ${item.answerMineral ?? ""}`.toLowerCase().includes(query))
        : data.faq;
      payload = hits.length ? hits : data.faq;
      break;
    }
    case "get_contact":
      payload = data.contact;
      break;
    default:
      return null;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: Array.isArray(payload) ? { items: payload } : payload,
    isError: false,
  };
}

export const onRequestOptions = (): Response => new Response(null, { status: 204, headers: CORS });

export const onRequestGet = (): Response =>
  // No server-initiated stream: this server only answers POSTs.
  new Response("Method Not Allowed – POST JSON-RPC messages to /mcp.", {
    status: 405,
    headers: { Allow: "POST, OPTIONS", ...CORS },
  });

export const onRequestPost = async (context: Context): Promise<Response> => {
  let message: JsonRpcRequest;
  try {
    message = (await context.request.json()) as JsonRpcRequest;
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return json(rpcError(message?.id ?? null, -32600, "Invalid Request"), 400);
  }

  // Notifications (no id) are acknowledged without a body.
  if (message.id === undefined || message.id === null) {
    return new Response(null, { status: 202, headers: CORS });
  }

  switch (message.method) {
    case "initialize": {
      const requested = String(message.params?.protocolVersion ?? "");
      return json(
        rpcResult(message.id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "anewstyle", title: "ANEW STYLE", version: "1.0.0" },
          instructions:
            "Read-only facts about ANEW STYLE illuminated stone and mineral panels (Brno, CZ): prices, versions, sizes, stone patterns, mineral decors, FAQ and contact. Inquiries are sent by people via the contact form at https://anewstyle.cz/#contact.",
        }),
      );
    }
    case "ping":
      return json(rpcResult(message.id, {}));
    case "tools/list":
      return json(rpcResult(message.id, { tools: TOOLS }));
    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const output = await callTool(context, name, args);
        return output
          ? json(rpcResult(message.id, output))
          : json(rpcError(message.id, -32602, `Unknown tool: ${name}`));
      } catch {
        return json(
          rpcResult(message.id, {
            content: [{ type: "text", text: "Site data is temporarily unavailable." }],
            isError: true,
          }),
        );
      }
    }
    default:
      return json(rpcError(message.id, -32601, `Method not found: ${message.method}`));
  }
};
