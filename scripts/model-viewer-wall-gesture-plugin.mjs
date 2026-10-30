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
  {
    source: `if (hitPosition != null) {
                    this.isTranslating = true;
                    this.lastDragPosition.copy(hitPosition);
                }
                else if (this.placeOnWall === false) {`,
    replacement: `if (hitPosition != null) {
                    this.isTranslating = true;
                    this.lastDragPosition.copy(hitPosition);
                }
                else if (this.placeOnWall && fingers[0].results.length > 0) {
                    const wallPosition = this.getHitPoint(fingers[0].results[0]);
                    if (wallPosition != null) {
                        this.goalPosition.copy(wallPosition);
                        this.lastDragPosition.copy(wallPosition);
                        this.isTranslating = true;
                        box.show = true;
                    }
                }
                else if (this.placeOnWall === false) {`,
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
 * lets one finger move it over that surface. A tap outside the model now uses
 * the detected wall hit as a new anchor, so placement does not depend on the
 * initial centre-screen hit. Keep pinch scaling, but suppress manual yaw so an
 * accidental two-finger twist cannot pull the panel away from the wall.
 */
export function modelViewerWallGesturePlugin() {
  return {
    name: "anewstyle-model-viewer-wall-gesture",
    enforce: "pre",
    transform: suppressModelViewerWallRotation,
  };
}
