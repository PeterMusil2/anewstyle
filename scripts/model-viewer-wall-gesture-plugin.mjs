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
 * model-viewer already aligns wall content to the detected surface normal and
 * lets one finger move it over that surface. Keep that automatic alignment and
 * pinch scaling, but suppress manual yaw so the panel cannot be pulled away
 * from the wall by an accidental two-finger twist.
 */
export function modelViewerWallGesturePlugin() {
  return {
    name: "anewstyle-model-viewer-wall-gesture",
    enforce: "pre",
    transform: suppressModelViewerWallRotation,
  };
}
