/** Shared AR configuration for wall-mounted illuminated panels. */
export const PANEL_AR_PLACEMENT = "wall";

/**
 * Android Scene Viewer downloads the original GLB again, so scene-graph
 * texture swaps are lost there. Runtime-textured mineral panels therefore
 * use WebXR on Android and auto-generated Quick Look USDZ on iOS.
 */
export function panelArModes(runtimeTexture: boolean): string {
  return runtimeTexture ? "webxr quick-look" : "webxr scene-viewer quick-look";
}
