export type GalleryItemType = "image" | "video" | "360";

export interface CloudinaryGalleryItem {
  type: GalleryItemType;
  thumb: string;
  full: string;
  width?: number;
  height?: number;
  alt?: string;
}

interface GalleryJson {
  generatedAt: string | null;
  items: CloudinaryGalleryItem[];
}

const GALLERY_FILE = "public/data/gallery.json";

/**
 * Load Cloudinary gallery items generated at build time by
 * `scripts/build-cloudinary-gallery.mjs`. Runs only during the static build
 * (Node), so it reads the generated JSON straight from disk and fails soft to
 * an empty list when the file is missing (e.g. dev without CLOUDINARY_URL).
 */
let cache: Promise<CloudinaryGalleryItem[]> | null = null;

async function load(): Promise<CloudinaryGalleryItem[]> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const raw = await readFile(resolve(process.cwd(), GALLERY_FILE), "utf8");
    const data = JSON.parse(raw) as GalleryJson;
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export function getGalleryItems(): Promise<CloudinaryGalleryItem[]> {
  cache ??= load();
  return cache;
}
