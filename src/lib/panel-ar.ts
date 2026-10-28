/** Shared AR configuration for wall-mounted illuminated panels. */
export const PANEL_AR_PLACEMENT = "wall";

/**
 * Keep Android AR inside the browser. Scene Viewer is intentionally excluded:
 * it is hosted by the Google app, which can crash even when ARCore itself is
 * healthy. iOS continues to use Quick Look.
 */
export function panelArModes(): string {
  return "webxr quick-look";
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
