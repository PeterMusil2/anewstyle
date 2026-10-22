/**
 * Image sets stored in the repo (no image CDN).
 *
 * One photo = watermarked AVIF files in fixed widths, never upscaled:
 *   public/media/<images|360>/<name>-<width>.avif
 * Content stores only the base path `/media/<images|360>/<name>`; the
 * widths and the intrinsic size are read from the files at build time. Files
 * are written by the CMS in the browser (public/admin/media-upload.js) or by
 * scripts/image-set.ts, both following src/lib/image-pipeline.ts.
 */
import { closeSync, existsSync, openSync, readSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export interface ImageSet {
  /** Base path, e.g. /media/images/obyvak-x7k2 */
  src: string;
  width: number;
  height: number;
  widths: number[];
}

export interface Focus {
  x: number;
  y: number;
}

const PUBLIC = resolve(process.cwd(), "public");
const cache = new Map<string, ImageSet | undefined>();
const dirCache = new Map<string, string[]>();

export const isImageSet = (src?: string) => Boolean(src && /^\/media\/[^.]+$/.test(src));

/** Width × height from the AVIF `ispe` box (first few hundred bytes). */
function avifSize(file: string) {
  const fd = openSync(file, "r");
  const head = Buffer.alloc(1024);
  readSync(fd, head, 0, head.length, 0);
  closeSync(fd);
  const at = head.indexOf("ispe");
  if (at < 0) return undefined;
  return { width: head.readUInt32BE(at + 8), height: head.readUInt32BE(at + 12) };
}

export function imageSet(src?: string): ImageSet | undefined {
  if (!src || !isImageSet(src)) return undefined;
  if (cache.has(src)) return cache.get(src);

  const dir = resolve(PUBLIC, `.${dirname(src)}`);
  const name = basename(src);
  if (!dirCache.has(dir)) dirCache.set(dir, existsSync(dir) ? readdirSync(dir) : []);
  const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.avif$`);
  const widths = dirCache
    .get(dir)!
    .map((file) => pattern.exec(file)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);

  const largest = widths.at(-1);
  const size = largest ? avifSize(resolve(dir, `${name}-${largest}.avif`)) : undefined;
  const set = size ? { src, ...size, widths } : undefined;
  if (!set) console.warn(`[image-set] no AVIF files for ${src}`);
  cache.set(src, set);
  return set;
}

export const urlOf = (set: ImageSet, width: number) => `${set.src}-${width}.avif`;

/** `srcset` for the widths within [min, max]; always at least one candidate. */
export function srcsetOf(set: ImageSet, { min = 0, max = Infinity } = {}) {
  let widths = set.widths.filter((w) => w >= min && w <= max);
  if (!widths.length) widths = [min > 0 ? set.widths.at(-1)! : set.widths[0]];
  return widths.map((w) => `${urlOf(set, w)} ${w}w`).join(", ");
}

/** Smallest file at least `target` px wide (else the largest). */
export const pick = (set: ImageSet, target: number) =>
  set.widths.find((w) => w >= target) ?? set.widths.at(-1)!;

export const focusStyle = (focus?: Focus) =>
  focus ? `object-position: ${focus.x}% ${focus.y}%` : undefined;
