#!/usr/bin/env bun
/**
 * One-off: move gallery photos and 360° panoramas from Cloudinary into the
 * repository as watermarked image sets (public/media/<images|360>/).
 *
 *   bun scripts/migrate-gallery-to-repo.ts
 *
 * For every Cloudinary *image* in src/data/gallery-cms.json it downloads the
 * original (no transformations), runs it through scripts/image-set.ts and
 * rewrites the entry to the new base path, keeping caption, bonus, hidden and
 * order. Videos stay on Cloudinary. The JSON is saved after each item, so an
 * interrupted run continues where it stopped. Nothing is deleted in
 * Cloudinary.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Focus } from "../src/lib/image-set";
import { makeImageSet } from "./image-set";

interface Entry {
  media: string;
  alt?: { cs?: string; en?: string };
  bonus?: boolean;
  panorama?: boolean;
  hidden?: boolean;
  focus?: Focus;
  width?: number;
  height?: number;
}

const CMS_FILE = resolve("src/data/gallery-cms.json");
const IMAGE = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:\?.*)?$/i;

// Same rule as public/admin/media-upload.js.
const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const data = JSON.parse(await readFile(CMS_FILE, "utf8")) as { media: Entry[] };
const save = () => writeFile(CMS_FILE, `${JSON.stringify(data, null, 2)}\n`);
const todo = data.media.filter((entry) => IMAGE.test(entry.media));
console.log(`${todo.length} Cloudinary image(s) to migrate.`);

for (const [n, entry] of todo.entries()) {
  const [, cloud, publicId] = IMAGE.exec(entry.media)!;
  const kind = entry.panorama || /\/360\//.test(publicId) ? "360" : "photo";
  const base = `/media/${kind === "360" ? "360" : "images"}/${slugify(publicId.split("/").pop()!)}`;
  const original = `https://res.cloudinary.com/${cloud}/image/upload/${publicId}`;
  const started = Date.now();
  const set = await makeImageSet(original, base, { kind });

  const { alt, bonus, hidden } = entry;
  data.media[data.media.indexOf(entry)] = {
    media: base,
    alt,
    bonus,
    panorama: kind === "360",
    hidden,
    ...(kind === "photo" ? { focus: set.focus } : {}),
    width: set.width,
    height: set.height,
  };
  await save();
  console.log(
    `[${n + 1}/${todo.length}] ${publicId} → ${base} (${set.width}×${set.height}, ${set.widths.join("/")}, ${((Date.now() - started) / 1000).toFixed(1)} s)`,
  );
}
console.log("✓ Done. Review the diff of src/data/gallery-cms.json and public/media/.");
