/** Shared AR configuration for wall-mounted illuminated panels. */
export const PANEL_AR_PLACEMENT = "wall";
export const STONE_AR_MODEL_PATH = "/3d/products/Rockfoil_DARKGOLD_AR_vertical_unlit.glb";

export function panelArModelPath(modelPath: string, landscape: boolean): string {
  if (!landscape) return modelPath;
  if (!modelPath.includes("_vertical")) {
    throw new Error(`AR model has no landscape variant: ${modelPath}`);
  }
  return modelPath.replace("_vertical", "_horizontal");
}

const SAMSUNG_INTERNET_PACKAGE = "com.sec.android.app.sbrowser";

const handoffTarget = (search: string) => new URLSearchParams(search).get("ar-browser");

export function shouldOpenArInSamsungInternet(userAgent: string, search: string): boolean {
  const directFallback = new URLSearchParams(search).get("ar-direct") === "1";
  return /Android/i.test(userAgent) && !/SamsungBrowser/i.test(userAgent) && !directFallback;
}

/** Chrome and the Google app on iOS cannot launch model-viewer Quick Look. */
export function shouldOpenArInSafari(userAgent: string, search: string): boolean {
  const directFallback = new URLSearchParams(search).get("ar-direct") === "1";
  const googleBrowser = /(?:CriOS|GSA)\//i.test(userAgent);
  return googleBrowser && handoffTarget(search) !== "safari" && !directFallback;
}

/**
 * Open the same HTTPS page in Samsung Internet. If the app is unavailable,
 * Chrome returns to a one-shot direct WebXR fallback instead of looping.
 */
export function samsungInternetArIntent(currentUrl: string): string {
  const destination = new URL(currentUrl);
  destination.searchParams.delete("ar-direct");
  destination.searchParams.delete("ar-handoff");
  destination.searchParams.delete("ar-browser");
  destination.hash = "";

  const fallback = new URL(destination);
  fallback.searchParams.set("ar-direct", "1");
  destination.searchParams.set("ar-handoff", "1");
  destination.searchParams.set("ar-browser", "samsung");
  const scheme = destination.protocol.replace(":", "");

  return `intent://${destination.host}${destination.pathname}${destination.search}`
    + `#Intent;scheme=${scheme};package=${SAMSUNG_INTERNET_PACKAGE};`
    + `S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end`;
}

/**
 * Open the same page in Safari, where model-viewer can hand the panel to
 * Quick Look. x-safari-http(s) is an iOS application URL scheme, so this must
 * run synchronously from the user's AR-button click.
 */
export function safariArUrl(currentUrl: string): string {
  const destination = new URL(currentUrl);
  destination.searchParams.delete("ar-direct");
  destination.searchParams.delete("ar-handoff");
  destination.searchParams.delete("ar-browser");
  destination.searchParams.set("ar-handoff", "1");
  destination.searchParams.set("ar-browser", "safari");
  destination.hash = "";

  const scheme = destination.protocol === "http:" ? "x-safari-http" : "x-safari-https";
  return `${scheme}://${destination.host}${destination.pathname}${destination.search}`;
}

/**
 * Keep Android AR inside the browser. Scene Viewer is intentionally excluded:
 * it is hosted by the Google app, which can crash even when ARCore itself is
 * healthy. iOS continues to use Quick Look.
 */
export function panelArModes(): string {
  return "webxr quick-look";
}

/**
 * WebXR renders from the model-viewer host. Keep the preloaded host behind the
 * page, but promote it before activateAR() so Android Chrome can present its
 * canvas and the built-in exit control.
 */
export function panelArViewerStyle(active: boolean): string {
  const interaction = active
    ? "pointer-events:auto;z-index:2147483647"
    : "pointer-events:none;z-index:-1";
  return `position:fixed;inset:0;width:100vw;height:100svh;${interaction}`;
}

export function mineralArModelPath(texturePath: string): string {
  const match = texturePath.match(/\/mineral-(\d+)\.[a-z0-9]+$/i);
  if (!match) throw new Error(`Unsupported mineral texture path: ${texturePath}`);
  return `/3d/products/Mineral_${match[1].padStart(2, "0")}_3D_vertical.glb`;
}

type Wait = (milliseconds: number) => Promise<void>;

/**
 * model-viewer selects its AR mode asynchronously after updateComplete.
 * Poll briefly so a transient false does not permanently disable the CTA.
 */
export async function waitForArAvailability(
  canActivate: () => boolean,
  wait: Wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = 40,
  intervalMs = 100,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (canActivate()) return true;
    if (attempt < attempts - 1) await wait(intervalMs);
  }
  return false;
}
