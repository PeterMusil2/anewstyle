/** Shared AR configuration for wall-mounted illuminated panels. */
export const PANEL_AR_PLACEMENT = "wall";

/**
 * Android Scene Viewer downloads the original GLB again, so scene-graph
 * texture swaps are lost there. Runtime-textured mineral panels therefore
 * use WebXR on Android and auto-generated Quick Look USDZ on iOS.
 */
export function panelArModes(runtimeTexture: boolean): string {
  // On some Android Chrome builds WebXR is advertised but fails when the
  // session starts. model-viewer's asynchronous fallback then loses the
  // original tap, so Scene Viewer must be selected first for baked models.
  return runtimeTexture ? "webxr quick-look" : "scene-viewer webxr quick-look";
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
