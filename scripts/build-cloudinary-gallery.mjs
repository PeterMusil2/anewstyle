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
function categoryOf(resource) {
  if (resource.resource_type === "video") return "video";

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

/**
 * Build a srcset for one explicit format.
 *
 * `f_auto` negotiates via the Accept header, but on this account it settles on
 * WebP even when the browser advertises AVIF. Requesting the format explicitly
 * and letting <picture> pick the source is both smaller and predictable.
 */
function tileSrcSet(publicId, format) {
  return THUMB_WIDTHS.map((w) => {
    const url = cloudinary.url(publicId, {
      ...tileOpts,
      fetch_format: format,
      width: w,
    });
    // srcset is comma-delimited and Cloudinary joins transformation parameters
    // with commas ("ar_16:9,c_fill,..."), which a browser would mis-split into
    // bogus candidates. Percent-encoding those commas keeps one transformation
    // component and delivers byte-identical output.
    return `${encodeTransformCommas(url)} ${w}w`;
  }).join(", ");
}

/** Percent-encode commas in the transformation segment of a delivery URL. */
function encodeTransformCommas(url) {
  return url.replace(
    /\/(image|video)\/upload\/([^/]+)\//,
    (_m, kind, transform) =>
      `/${kind}/upload/${transform.replace(/,/g, "%2C")}/`
  );
}

function buildItem(resource, { bonus = false } = {}) {
  const publicId = resource?.public_id;
  if (!publicId) return null;

  const category = categoryOf(resource);
  const alt = toAlt(publicId);

  const nativeW = typeof resource.width === "number" ? resource.width : 1600;
  const nativeH = typeof resource.height === "number" ? resource.height : 900;
  const thumbW = Math.min(THUMB_WIDTH, nativeW);
  const thumbH = Math.max(1, Math.round((thumbW * nativeH) / nativeW));

  const base = { type: category, width: thumbW, height: thumbH, alt };
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
      // The grid tile is cropped like any other, so it gets the same AVIF set.
      width: THUMB_WIDTH,
      height: Math.round((THUMB_WIDTH * 9) / 16),
      thumb: cloudinary.url(publicId, { ...tileOpts, fetch_format: "auto", width: THUMB_WIDTH }),
      thumbAvif: tileSrcSet(publicId, "avif"),
      thumbWebp: tileSrcSet(publicId, "webp"),
      // The panorama itself must keep its full 2:1 equirectangular frame -
      // cropping it would make Photo Sphere Viewer render a distorted sphere.
      full: cloudinary.url(publicId, { ...imageOpts, width: PANO_FULL_WIDTH }),
    };
  }

  return {
    ...base,
    // Tiles are a fixed 16:9 so the grid reads as one uniform set.
    width: THUMB_WIDTH,
    height: Math.round((THUMB_WIDTH * 9) / 16),
    thumb: cloudinary.url(publicId, { ...tileOpts, fetch_format: "auto", width: THUMB_WIDTH }),
    thumbAvif: tileSrcSet(publicId, "avif"),
    thumbWebp: tileSrcSet(publicId, "webp"),
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

  cloudinary.config({ secure: true });

  const resources = await collectResources();

  // Bonus assets live outside the gallery folder and are fetched separately so
  // an empty bonus folder can never trigger the gallery's fallback scan.
  const bonusResources = await searchAllResources(
    subtreeExpression(BONUS_FOLDER)
  ).catch(() => []);

  // Display order when no filter is active: videos, then photos, then 360.
  // Within a category the public_id sort from the search is preserved, and
  // bonus items trail the regular ones so the default view stays familiar.
  const CATEGORY_ORDER = { video: 0, image: 1, "360": 2 };

  const items = [
    ...resources.map((r) => buildItem(r)),
    ...bonusResources.map((r) => buildItem(r, { bonus: true })),
  ]
    .filter(Boolean)
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.type] - CATEGORY_ORDER[b.type] ||
        Number(a.bonus ?? false) - Number(b.bonus ?? false)
    );

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
