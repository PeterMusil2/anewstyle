/**
 * Gallery items for the Galerie page, built from the CMS list
 * (src/data/gallery-cms.json) at build time.
 *
 * - Photos and 360° panoramas are image sets in public/media/ (see
 *   src/lib/image-set.ts); widths and sizes come from the files.
 * - Videos stay on Cloudinary; their poster and MP4 URLs are derived from the
 *   stored URL, so the build needs no Cloudinary credentials.
 *
 * The CMS list is the source of truth: order, captions, bonus and hidden.
 */
import cms from "../data/gallery-cms.json";
import { focusStyle, imageSet, pick, srcsetOf, urlOf, type Focus } from "./image-set";

type GalleryItemType = "image" | "video" | "360";

interface CmsEntry {
  media: string;
  alt?: { cs?: string; en?: string };
  bonus?: boolean;
  panorama?: boolean;
  hidden?: boolean;
  focus?: Focus;
}

export interface GalleryItem {
  type: GalleryItemType;
  /** Tile shape in the grid: a 2×1 or 1×2 cell. */
  orientation: "landscape" | "portrait";
  /** Gated bonus asset: hidden until the visitor unlocks the bonus content. */
  bonus: boolean;
  alt: string;
  /** English caption from the CMS (falls back to `alt`). */
  altEn?: string;
  tile: { src: string; srcset?: string; width: number; height: number; style?: string };
  /** Lightbox image, MP4 or equirectangular panorama. */
  full: string;
  /** Lightbox candidates (photos), for Fancybox `data-srcset`. */
  fullSrcset?: string;
}

// Video delivery – the same transformations Cloudinary served before, so no
// new derivatives (credits) are created.
const VIDEO = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/video\/upload\/(?:[^/]*,[^/]*\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?(?:\?.*)?$/i;
const VIDEO_THUMB_WIDTH = 800;
const VIDEO_FULL_WIDTH = 1280;

/** Tile files stop here: a 2-column tile is ~800 CSS px, ×2 for retina. */
const TILE_MAX = 1800;
const PANO_TILE_MAX = 2048;
/** Lightbox never gets less than this. */
const LIGHTBOX_MIN = 1200;

/** Prettify a file name into a default caption. */
function toAlt(media: string) {
  const base = media.split("/").pop() ?? "";
  const words = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "ANEW STYLE";
}

function buildItem(entry: CmsEntry): GalleryItem | null {
  const base = {
    bonus: Boolean(entry.bonus),
    alt: entry.alt?.cs || toAlt(entry.media),
    ...(entry.alt?.en ? { altEn: entry.alt.en } : {}),
  };

  const video = VIDEO.exec(entry.media);
  if (video) {
    const [, cloud, id] = video;
    const root = `https://res.cloudinary.com/${cloud}/video/upload`;
    return {
      ...base,
      type: "video",
      orientation: "landscape",
      tile: { src: `${root}/c_limit,q_auto,w_${VIDEO_THUMB_WIDTH}/v1/${id}.jpg`, width: 800, height: 450 },
      full: `${root}/c_limit,q_auto,w_${VIDEO_FULL_WIDTH}/v1/${id}.mp4`,
    };
  }

  const set = imageSet(entry.media);
  if (!set) {
    console.warn(`[gallery] skipped ${entry.media} – not an image set in public/media/ or a Cloudinary video`);
    return null;
  }
  const largest = urlOf(set, set.widths.at(-1)!);

  if (entry.panorama || entry.media.startsWith("/media/360/")) {
    return {
      ...base,
      type: "360",
      orientation: "landscape",
      // The tile crops the panorama; the viewer gets the full 2:1 frame.
      tile: { src: urlOf(set, pick(set, 800)), srcset: srcsetOf(set, { max: PANO_TILE_MAX }), width: 800, height: 450 },
      full: largest,
    };
  }

  const orientation = set.height > set.width ? "portrait" : "landscape";
  return {
    ...base,
    type: "image",
    orientation,
    tile: {
      src: urlOf(set, pick(set, 800)),
      srcset: srcsetOf(set, { max: TILE_MAX }),
      width: 800,
      height: orientation === "portrait" ? 1422 : 450,
      style: focusStyle(entry.focus),
    },
    full: largest,
    fullSrcset: srcsetOf(set, { min: LIGHTBOX_MIN }),
  };
}

let cache: GalleryItem[] | undefined;

export function getGalleryItems(): GalleryItem[] {
  cache ??= (cms.media as CmsEntry[])
    .filter((entry) => entry.media && !entry.hidden)
    .map(buildItem)
    .filter((item): item is GalleryItem => item !== null)
    // Bonus items trail the public ones; otherwise the CMS order (stable sort).
    .sort((a, b) => Number(a.bonus) - Number(b.bonus));
  return cache;
}
