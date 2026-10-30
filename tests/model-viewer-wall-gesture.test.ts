import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  modelViewerWallGesturePlugin,
  suppressModelViewerWallRotation,
} from "../scripts/model-viewer-wall-gesture-plugin.mjs";

const rendererId = "C:/project/node_modules/@google/model-viewer/lib/three-components/ARRenderer.js";

describe("model-viewer wall gestures", () => {
  test("wall placement keeps automatic alignment, dragging and pinch scaling", () => {
    const source = readFileSync(
      "node_modules/@google/model-viewer/lib/three-components/ARRenderer.js",
      "utf8",
    );
    const result = suppressModelViewerWallRotation(source, rendererId);

    expect(result).not.toBeNull();
    expect(result!.code).toContain(
      "this.goalYaw = Math.atan2(hitMatrix.elements[4], hitMatrix.elements[6]);",
    );
    expect(result!.code).toContain("if (this.placeOnWall) {");
    expect(result!.code).toContain("this.goalPosition.copy(hitPoint);");
    expect(result!.code).toContain("if (!this.placeOnWall) { this.goalYaw += deltaYaw; }");
    expect(result!.code).toContain("if (!this.placeOnWall) { this.goalYaw += angle - this.lastAngle; }");
    expect(result!.code).toContain("this.setScale(separation)");
  });

  test("the Astro build uses the simple wall gesture plugin without a rotation gizmo", () => {
    const config = readFileSync("astro.config.mjs", "utf8");
    expect(config).toContain('import { modelViewerWallGesturePlugin } from "./scripts/model-viewer-wall-gesture-plugin.mjs";');
    expect(config).toContain("modelViewerWallGesturePlugin()");
    expect(config).not.toContain("modelViewerWallControlsPlugin()");
  });

  test("the transform is limited to model-viewer's AR renderer", () => {
    expect(suppressModelViewerWallRotation("this.goalYaw += deltaYaw;", "/src/app.js")).toBeNull();
    expect(modelViewerWallGesturePlugin().enforce).toBe("pre");
  });

  test("fails loudly when a model-viewer update changes the patched code", () => {
    expect(() => suppressModelViewerWallRotation("export {};", rendererId)).toThrow(
      "Unsupported model-viewer ARRenderer",
    );
  });
});
