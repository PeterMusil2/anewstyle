import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  customizeModelViewerAr,
  modelViewerWallControlsPlugin,
} from "../scripts/model-viewer-wall-controls-plugin.mjs";

const rendererId = "C:/project/node_modules/@google/model-viewer/lib/three-components/ARRenderer.js";
const menuId = "C:/project/node_modules/@google/model-viewer/lib/three-components/XRMenuPanel.js";
const rendererSource = readFileSync("node_modules/@google/model-viewer/lib/three-components/ARRenderer.js", "utf8");
const menuSource = readFileSync("node_modules/@google/model-viewer/lib/three-components/XRMenuPanel.js", "utf8");

describe("model-viewer wall rotation arrows", () => {
  test("keeps pinch scaling but suppresses unstable wall yaw", () => {
    const code = customizeModelViewerAr(rendererSource, rendererId)!.code;
    expect(code).toContain("if (!this.placeOnWall) { this.goalYaw += deltaYaw; }");
    expect(code).toContain("this.setScale(separation)");
  });

  test("renders tappable arrows and applies persistent quarter turns", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    const menu = customizeModelViewerAr(menuSource, menuId)!.code;
    expect(renderer).toContain("this.menuPanel.setRotationOnly()");
    expect(renderer).toContain("rotationButtonPointIntersection");
    expect(renderer).toContain("this.goalRoll += rotationDirection * Math.PI / 2");
    expect(renderer).toContain("quaternion.multiply(arRollQuaternion)");
    expect(menu).toContain("ROTATE_LEFT_ICON_SVG");
    expect(menu).toContain("ROTATE_RIGHT_ICON_SVG");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotateLeftButton)");
    expect(menu).toContain("this.rotationOnly ? -0.16 : -0.2");
  });

  test("is limited to model-viewer AR modules and fails loudly on drift", () => {
    expect(customizeModelViewerAr("export {};", "/src/app.js")).toBeNull();
    expect(modelViewerWallControlsPlugin().enforce).toBe("pre");
    expect(() => customizeModelViewerAr("export {};", rendererId)).toThrow("Unsupported model-viewer ARRenderer");
    expect(() => customizeModelViewerAr("export {};", menuId)).toThrow("Unsupported model-viewer XRMenuPanel");
  });
});
