#!/usr/bin/env node

/**
 * Build-time Cloudinary gallery fetch.
 *
 * Lists every image and video under the `AnewStyle/Gallery` Cloudinary folder
 * (recursively) via the authenticated Admin Search API, classifies each asset
 * into one of three gallery categories, builds optimized public delivery URLs
 * and writes them to `public/data/gallery.json`. Astro reads that JSON at build
 * time (see `src/lib/cloudinary-gallery.ts`) and renders the gallery tiles.
 *
 * Categories (mapped to the on-page filter + viewer choice):
 *   - "video"  → resource_type video            → Fancybox HTML5 video
 *   - "360"    → image tagged/foldered as 360    → Photo Sphere Viewer (panorama)
 *   - "image"  → any other image                 → Fancybox image
 *
 * Optimization: images use f_auto + q_auto, so a single URL serves AVIF to
 * browsers that support it (WebP/JPEG fallback otherwise), at capped widths.
 *
 * Credentials come from a single env var, read automatically by the SDK:
 *   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 *
 * If CLOUDINARY_URL is missing the script logs a warning and exits 0 without
 * overwriting any existing JSON, so local dev builds keep working without creds.
 */

import { v2 as cloudinary } from "cloudinary";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

// Where the gallery assets live. Override with CLOUDINARY_GALLERY_FOLDER if the
// media library is ever restructured, so a folder move needs no code change.
const GALLERY_FOLDER =
  process.env.CLOUDINARY_GALLERY_FOLDER || "AnewStyle/Gallery";

// Root of the brand's media library, used as a fallback when GALLERY_FOLDER
// matches nothing (e.g. the gallery folders still sit directly under the root).
const ROOT_FOLDER = GALLERY_FOLDER.split("/")[0];

// Gated extra content, unlocked once a visitor submits the contact form. Same
// 360/images/videos layout as the gallery folder; items are flagged so the page
// can keep them hidden until unlocked.
const BONUS_FOLDER = process.env.CLOUDINARY_BONUS_FOLDER || `${ROOT_FOLDER}/Bonus`;

// Subfolders of ROOT_FOLDER that must never appear in the main gallery. Only
// applies to the fallback scan - anything inside GALLERY_FOLDER is always
// included, and bonus assets are collected separately.
const EXCLUDED_FOLDERS = ["bonus"];

const OUT_FILE = path.join(process.cwd(), "public", "data", "gallery.json");

// Gallery entries managed in Decap CMS (uploads, captions, 360 flag, hiding).
const CMS_FILE = path.join(process.cwd(), "src", "data", "gallery-cms.json");

/**
 * Turn a Cloudinary delivery URL into its public_id and resource type:
 * https://res.cloudinary.com/<cloud>/<image|video>/upload/v123/<public_id>.<ext>
 */
function parseCloudinaryUrl(url) {
  const match = String(url || "").match(
    /\/(image|video|raw)\/upload\/(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:\?.*)?$/i
  );
  return match ? { resourceType: match[1], publicId: decodeURIComponent(match[2]) } : null;
}

/** Load CMS metadata keyed by public_id. Missing file → no overrides. */
async function loadCmsEntries() {
  try {
    const data = JSON.parse(await readFile(CMS_FILE, "utf8"));
    const entries = [];
    // Current shape: one "media" list with a bonus flag per entry (the
    // gallery-manager widget). Legacy "items"/"bonus" lists still work.
    const lists = Array.isArray(data?.media)
      ? [[data.media, null]]
      : [[data?.items, false], [data?.bonus, true]];
    for (const [list, listBonus] of lists) {
      (Array.isArray(list) ? list : []).forEach((entry, index) => {
        const parsed = parseCloudinaryUrl(entry?.media);
        if (!parsed) return;
        entries.push({
          ...parsed,
          bonus: listBonus ?? Boolean(entry.bonus),
          order: index,
          alt: entry.alt?.cs?.trim() || undefined,
          altEn: entry.alt?.en?.trim() || undefined,
          panorama: Boolean(entry.panorama),
          hidden: Boolean(entry.hidden),
        });
      });
    }
    return entries;
  } catch {
    return [];
  }
}

// Capped delivery widths (px). Thumbs feed the grid tiles; full feeds the
// lightbox. Panoramas need extra resolution to look sharp when zoomed.
const THUMB_WIDTH = 800;
const IMAGE_FULL_WIDTH = 1600;
const PANO_FULL_WIDTH = 4096;
const VIDEO_FULL_WIDTH = 1280;

// Grid tiles are cropped to 16:9 by CSS (.gitem__photo), so Cloudinary crops to
// the same ratio and every tile arrives at a uniform, display-sized resolution
// instead of a full-resolution original the browser then downscales.
const THUMB_RATIO = "16:9";

// Photos are snapped to one of two tile shapes so the grid stays a clean
// checkerboard: landscape fills a 2x1 cell, portrait a 1x2 one.
const PORTRAIT_RATIO = "9:16";

// Candidate tile widths for the srcset. The grid runs 4 columns at desktop down
// to 1 on mobile inside a ~1600px container, so a tile is roughly 400px wide
// (800px for the double-width first tile); the larger entries cover 2x DPR.
const THUMB_WIDTHS = [400, 600, 800, 1200, 1600];

/** Load CLOUDINARY_URL from a local .env if it isn't already in the environment. */
async function loadEnv() {
  if (process.env.CLOUDINARY_URL) return;
  try {
    const raw = await readFile(path.join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*CLOUDINARY_URL\s*=\s*(.+?)\s*$/);
      if (match) {
        process.env.CLOUDINARY_URL = match[1].replace(/^["']|["']$/g, "");
        break;
      }
    }
  } catch {
    // no .env file — that's fine, rely on the real environment
  }
}

/**
 * Match the whole subtree of `folder`, in either fixed- or dynamic-folder
 * accounts. Cloudinary exposes the path as `folder` on legacy accounts and
 * `asset_folder` on dynamic-folder ones, so both are checked.
 */
function subtreeExpression(folder) {
  return (
    `(folder="${folder}" OR folder:${folder}/* ` +
    `OR asset_folder="${folder}" OR asset_folder:${folder}/*)`
  );
}

/** Page through the Search API until every matching asset is collected. */
async function searchAllResources(expression) {
  const all = [];
  let nextCursor;

  do {
    // `tags` is needed for 360 detection via tags.
    const query = cloudinary.search
      .expression(`${expression} AND (resource_type:image OR resource_type:video)`)
      .with_field("tags")
      .sort_by("public_id", "asc")
      .max_results(500);

    if (nextCursor) query.next_cursor(nextCursor);

    const result = await query.execute();
    const resources = Array.isArray(result?.resources) ? result.resources : [];
    all.push(...resources);
    nextCursor = result?.next_cursor;
  } while (nextCursor);

  return all;
}

/** True when an asset sits inside one of the EXCLUDED_FOLDERS subtrees. */
function isExcluded(resource) {
  const folder = String(
    resource.asset_folder || resource.folder || resource.public_id || ""
  ).toLowerCase();

  return EXCLUDED_FOLDERS.some((name) => {
    const prefix = `${ROOT_FOLDER}/${name}`.toLowerCase();
    return folder === prefix || folder.startsWith(`${prefix}/`);
  });
}

/**
 * Collect the gallery assets.
 *
 * Primary source is GALLERY_FOLDER. If that matches nothing - which happens
 * when the media library keeps the category folders directly under the root
 * instead of nesting them - fall back to scanning the whole root and drop the
 * folders that are not part of the gallery. The fallback is announced so the
 * build log says exactly which layout was used.
 */
async function collectResources() {
  const scoped = await searchAllResources(subtreeExpression(GALLERY_FOLDER));
  if (scoped.length > 0) return scoped;

  console.warn(
    `\u26a0 No assets under "${GALLERY_FOLDER}" - falling back to "${ROOT_FOLDER}" ` +
      `(excluding ${EXCLUDED_FOLDERS.map((f) => `"${f}"`).join(", ")}).`
  );

  const rooted = await searchAllResources(subtreeExpression(ROOT_FOLDER));
  return rooted.filter((resource) => !isExcluded(resource));
}

/**
 * Classify an asset. Videos are detected by resource_type; 360 panoramas by a
 * "360" marker in tags, folder path, or public_id (so the GALERY_360 folder or
 * a `360` tag both work); everything else is a flat image.
 */
function categoryOf(resource, override) {
  if (resource.resource_type === "video") return "video";
  if (override?.panorama) return "360";

  const hay = [
    ...(Array.isArray(resource.tags) ? resource.tags : []),
    resource.asset_folder || "",
    resource.folder || "",
    resource.public_id || "",
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes("360") ? "360" : "image";
}

/** Prettify a public_id into a human-readable alt/caption. */
function toAlt(publicId) {
  const base = String(publicId || "").split("/").pop() || "";
  const words = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "ANEW STYLE";
}

// Shared image optimization: AVIF/WebP negotiated per request, auto quality,
// aspect preserved (no crop), capped width.
const imageOpts = { fetch_format: "auto", quality: "auto", crop: "limit" };

// Tile crop: fixed 16:9 at a display-sized width, subject-aware so the crop does
// not cut through the point of interest.
const tileOpts = {
  crop: "fill",
  gravity: "auto",
  aspect_ratio: THUMB_RATIO,
  quality: "auto",
};

/** Tile transform for one orientation. */
function tileOptsFor(orientation) {
  return orientation === "portrait"
    ? { ...tileOpts, aspect_ratio: PORTRAIT_RATIO }
    : tileOpts;
}

/**
 * Build the tile srcset. One <img srcset> with f_auto: Cloudinary picks
 * AVIF/WebP/JPEG from the Accept header, and if anything fails the browser
 * still has the plain `src` to fall back to. (Explicit <source> elements give
 * no fallback when their URLs fail, which blanked photos and 360 tiles.)
 * Commas inside a srcset URL are valid - only ", " separates candidates.
 */
function tileSrcSet(publicId, { orientation = "landscape" } = {}) {
  return THUMB_WIDTHS.map((w) => {
    const url = cloudinary.url(publicId, {
      ...tileOptsFor(orientation),
      fetch_format: "auto",
      width: w,
    });
    return `${url} ${w}w`;
  }).join(", ");
}

function buildItem(resource, { bonus = false, override } = {}) {
  const publicId = resource?.public_id;
  if (!publicId) return null;

  const category = categoryOf(resource, override);
  const alt = override?.alt ?? toAlt(publicId);

  const nativeW = typeof resource.width === "number" ? resource.width : 1600;
  const nativeH = typeof resource.height === "number" ? resource.height : 900;
  const thumbW = Math.min(THUMB_WIDTH, nativeW);
  const thumbH = Math.max(1, Math.round((thumbW * nativeH) / nativeW));

  const base = { type: category, width: thumbW, height: thumbH, alt };
  if (override?.altEn) base.altEn = override.altEn;
  if (bonus) base.bonus = true;

  if (category === "video") {
    return {
      ...base,
      thumb: cloudinary.url(publicId, {
        resource_type: "video",
        format: "jpg",
        quality: "auto",
        crop: "limit",
        width: thumbW,
      }),
      full: cloudinary.url(publicId, {
        resource_type: "video",
        quality: "auto",
        format: "mp4",
        crop: "limit",
        width: VIDEO_FULL_WIDTH,
      }),
    };
  }

  if (category === "360") {
    return {
      ...base,
      // The grid tile is cropped like any other, so it gets the same srcset.
      width: THUMB_WIDTH,
      height: Math.round((THUMB_WIDTH * 9) / 16),
      thumb: cloudinary.url(publicId, { ...tileOpts, fetch_format: "auto", width: THUMB_WIDTH }),
      thumbSrcset: tileSrcSet(publicId),
      // The panorama itself must keep its full 2:1 equirectangular frame -
      // cropping it would make Photo Sphere Viewer render a distorted sphere.
      full: cloudinary.url(publicId, { ...imageOpts, width: PANO_FULL_WIDTH }),
    };
  }

  // Snap to the nearest of the two tile shapes rather than cropping every
  // photo to landscape: a portrait shot keeps its portrait framing.
  const orientation = nativeH > nativeW ? "portrait" : "landscape";
  const tileW = THUMB_WIDTH;
  const tileH =
    orientation === "portrait"
      ? Math.round((tileW * 16) / 9)
      : Math.round((tileW * 9) / 16);

  return {
    ...base,
    orientation,
    width: tileW,
    height: tileH,
    thumb: cloudinary.url(publicId, {
      ...tileOptsFor(orientation),
      fetch_format: "auto",
      width: tileW,
    }),
    thumbSrcset: tileSrcSet(publicId, { orientation }),
    // The lightbox keeps the original aspect and negotiates its own format,
    // so it stays correct on browsers without AVIF support.
    full: cloudinary.url(publicId, { ...imageOpts, width: IMAGE_FULL_WIDTH }),
  };
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await loadEnv();

  if (!process.env.CLOUDINARY_URL) {
    const exists = await fileExists(OUT_FILE);
    console.warn(
      `⚠ CLOUDINARY_URL not set — skipping Cloudinary gallery fetch.${
        exists ? " Keeping existing public/data/gallery.json." : ""
      }`
    );
    if (!exists) {
      await mkdir(path.dirname(OUT_FILE), { recursive: true });
      await writeFile(
        OUT_FILE,
        JSON.stringify({ generatedAt: null, items: [] }, null, 2) + "\n",
        "utf8"
      );
    }
    return;
  }

  // The SDK reads CLOUDINARY_URL when it is imported; re-read it here because
  // loadEnv() may only just have set it from .env.
  cloudinary.config(true);
  cloudinary.config({ secure: true });

  const resources = await collectResources();

  // Bonus assets live outside the gallery folder and are fetched separately so
  // an empty bonus folder can never trigger the gallery's fallback scan.
  const bonusResources = await searchAllResources(
    subtreeExpression(BONUS_FOLDER)
  ).catch(() => []);

  // CMS metadata: captions, 360 flag, hidden items and order. Entries whose
  // asset lives outside the scanned folders are fetched individually.
  const cmsEntries = await loadCmsEntries();
  const overrides = new Map(cmsEntries.map((entry) => [entry.publicId, entry]));
  const known = new Set([...resources, ...bonusResources].map((r) => r.public_id));
  const extra = [];
  for (const entry of cmsEntries) {
    if (known.has(entry.publicId) || entry.hidden) continue;
    try {
      extra.push({
        resource: await cloudinary.api.resource(entry.publicId, {
          resource_type: entry.resourceType,
        }),
        bonus: entry.bonus,
      });
    } catch {
      console.warn(`\u26a0 CMS gallery entry not found in Cloudinary: ${entry.publicId}`);
    }
  }

  // Display order when no filter is active: videos, then photos, then 360.
  // Within a category CMS-ordered items come first, then the public_id sort
  // from the search; bonus items trail the regular ones.
  const CATEGORY_ORDER = { video: 0, image: 1, "360": 2 };
  const orderOf = (item) => overrides.get(item._id)?.order ?? Number.MAX_SAFE_INTEGER;

  let pool = [
    ...resources.map((r) => ({ r, bonus: false })),
    ...bonusResources.map((r) => ({ r, bonus: true })),
    ...extra.map(({ resource, bonus }) => ({ r: resource, bonus })),
  ];

  // Once the CMS lists anything, it is the source of truth: the web shows
  // exactly the CMS entries (deleting one there removes it from the site),
  // and the list it sits in decides gallery vs bonus. Assets that are only in
  // Cloudinary are reported so they can be added in the CMS.
  if (cmsEntries.length > 0) {
    const byId = new Map(pool.map(({ r }) => [r.public_id, r]));
    const unlisted = [...byId.keys()].filter((id) => !overrides.has(id));
    if (unlisted.length) {
      console.warn(
        `\u2139 ${unlisted.length} Cloudinary asset(s) are not in the CMS gallery and stay hidden: ` +
          unlisted.join(", ")
      );
    }
    pool = cmsEntries
      .filter((entry) => !entry.hidden && byId.has(entry.publicId))
      .map((entry) => ({ r: byId.get(entry.publicId), bonus: entry.bonus }));
  }

  const items = pool
    .filter(({ r }) => !overrides.get(r.public_id)?.hidden)
    .map(({ r, bonus }) => {
      const item = buildItem(r, { bonus, override: overrides.get(r.public_id) });
      return item ? { ...item, _id: r.public_id } : null;
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.type] - CATEGORY_ORDER[b.type] ||
        Number(a.bonus ?? false) - Number(b.bonus ?? false) ||
        orderOf(a) - orderOf(b)
    )
    .map(({ _id, ...item }) => item);

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) +
      "\n",
    "utf8"
  );

  const count = (t) => items.filter((i) => i.type === t).length;
  const bonusCount = items.filter((i) => i.bonus).length;

  // An empty result is a successful API call that matched nothing, which is
  // almost always a folder-path problem rather than something intentional.
  // Say so loudly: the build stays green either way, so this log line is the
  // only signal that the gallery silently shipped empty.
  if (items.length === 0) {
    console.warn(
      `\u26a0 Cloudinary gallery is EMPTY - the credentials worked but no assets ` +
        `matched "${GALLERY_FOLDER}" or "${ROOT_FOLDER}". Check the folder path ` +
        `and capitalisation in the media library.`
    );
  }

  console.log(
    `✓ Cloudinary gallery: ${items.length} items ` +
      `(${count("image")} images, ${count("video")} videos, ${count("360")} panoramas` +
      `${bonusCount ? `, ${bonusCount} of them bonus` : ""}) ` +
      `→ public/data/gallery.json`
  );
}

// The Cloudinary gallery is an enhancement, never a build blocker: if the fetch
// fails (bad credentials, network, API outage) fall back to whatever
// public/data/gallery.json already holds, or an empty gallery, and exit 0 so
// the static site still deploys.
main().catch(async (err) => {
  console.warn(
    "\u26a0 Cloudinary gallery fetch failed \u2014 deploying without fresh gallery data."
  );
  console.warn(err?.message ?? err);

  if (await fileExists(OUT_FILE)) {
    console.warn("  Keeping existing public/data/gallery.json.");
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ generatedAt: null, items: [] }, null, 2) + "\n",
    "utf8"
  );
  console.warn("  Wrote an empty public/data/gallery.json.");
});
