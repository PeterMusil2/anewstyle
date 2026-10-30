import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  modelViewerWallGesturePlugin,
  suppressModelViewerWallRotation,
} from "../scripts/model-viewer-wall-gesture-plugin.mjs";

const rendererId = "C:/project/node_modules/@google/model-viewer/lib/three-components/ARRenderer.js";

describe("model-viewer wall gestures", () => {
  test("wall placement keeps pinch scaling but suppresses unstable yaw", () => {
    const source = readFileSync(
      "node_modules/@google/model-viewer/lib/three-components/ARRenderer.js",
      "utf8",
    );
    const result = suppressModelViewerWallRotation(source, rendererId);

    expect(result).not.toBeNull();
    expect(result!.code).toContain("if (!this.placeOnWall) { this.goalYaw += deltaYaw; }");
    expect(result!.code).toContain("if (!this.placeOnWall) { this.goalYaw += angle - this.lastAngle; }");
    expect(result!.code).toContain("this.setScale(separation)");
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
