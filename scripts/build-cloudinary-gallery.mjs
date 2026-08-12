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

const GALLERY_FOLDER = "AnewStyle/Gallery";
const OUT_FILE = path.join(process.cwd(), "public", "data", "gallery.json");

// Capped delivery widths (px). Thumbs feed the grid tiles; full feeds the
// lightbox. Panoramas need extra resolution to look sharp when zoomed.
const THUMB_WIDTH = 800;
const IMAGE_FULL_WIDTH = 1600;
const PANO_FULL_WIDTH = 4096;
const VIDEO_FULL_WIDTH = 1280;

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

/** Page through the Search API until every matching asset is collected. */
async function searchAllResources() {
  const all = [];
  let nextCursor;

  do {
    const query = cloudinary.search
      // Whole subtree of the gallery folder, in either fixed- or dynamic-folder
      // accounts, limited to images and videos. `tags` is needed for 360
      // detection via tags.
      .expression(
        `(folder="${GALLERY_FOLDER}" OR folder:${GALLERY_FOLDER}/* OR asset_folder="${GALLERY_FOLDER}" OR asset_folder:${GALLERY_FOLDER}/*) AND (resource_type:image OR resource_type:video)`
      )
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

function buildItem(resource) {
  const publicId = resource?.public_id;
  if (!publicId) return null;

  const category = categoryOf(resource);
  const alt = toAlt(publicId);

  const nativeW = typeof resource.width === "number" ? resource.width : 1600;
  const nativeH = typeof resource.height === "number" ? resource.height : 900;
  const thumbW = Math.min(THUMB_WIDTH, nativeW);
  const thumbH = Math.max(1, Math.round((thumbW * nativeH) / nativeW));

  const base = { type: category, width: thumbW, height: thumbH, alt };

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
      thumb: cloudinary.url(publicId, { ...imageOpts, width: thumbW }),
      // Equirectangular panorama, aspect preserved, AVIF where supported.
      full: cloudinary.url(publicId, { ...imageOpts, width: PANO_FULL_WIDTH }),
    };
  }

  return {
    ...base,
    thumb: cloudinary.url(publicId, { ...imageOpts, width: thumbW }),
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

  const resources = await searchAllResources();
  const items = resources.map(buildItem).filter(Boolean);

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 2) +
      "\n",
    "utf8"
  );

  const count = (t) => items.filter((i) => i.type === t).length;
  console.log(
    `✓ Cloudinary gallery: ${items.length} items ` +
      `(${count("image")} images, ${count("video")} videos, ${count("360")} panoramas) ` +
      `→ public/data/gallery.json`
  );
}

main().catch((err) => {
  console.error("Cloudinary gallery build failed:", err);
  process.exit(1);
});
