const AR_RENDERER_MODULE = "/@google/model-viewer/lib/three-components/ARRenderer.js";
const WALL_ROTATION_EDITS = [
  {
    source: "this.goalYaw += deltaYaw;",
    replacement: "if (!this.placeOnWall) { this.goalYaw += deltaYaw; }",
  },
  {
    source: "this.goalYaw += angle - this.lastAngle;",
    replacement: "if (!this.placeOnWall) { this.goalYaw += angle - this.lastAngle; }",
  },
];

export function suppressModelViewerWallRotation(code, id) {
  const normalizedId = id.replaceAll("\\", "/");
  if (!normalizedId.endsWith(AR_RENDERER_MODULE)) return null;

  let transformed = code;
  for (const edit of WALL_ROTATION_EDITS) {
    if (!transformed.includes(edit.source)) {
      throw new Error(`Unsupported model-viewer ARRenderer: missing ${edit.source}`);
    }
    transformed = transformed.replace(edit.source, edit.replacement);
  }
  return { code: transformed, map: null };
}

/**
 * model-viewer rotates two-finger wall gestures around world Y, which tilts a
 * wall panel away from its anchor and then snaps it back. Keep pinch scaling,
 * but suppress that unstable yaw only for wall placement.
 */
export function modelViewerWallGesturePlugin() {
  return {
    name: "anewstyle-model-viewer-wall-gesture",
    enforce: "pre",
    transform: suppressModelViewerWallRotation,
  };
}
