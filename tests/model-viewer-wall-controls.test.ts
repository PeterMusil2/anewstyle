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

describe("model-viewer wall perspective control", () => {
  test("keeps pinch scaling but suppresses unstable wall yaw", () => {
    const code = customizeModelViewerAr(rendererSource, rendererId)!.code;
    expect(code).toContain("if (!this.placeOnWall) { this.goalYaw += deltaYaw; }");
    expect(code).toContain("this.setScale(separation)");
  });

  test("renders a draggable perspective arc and keeps the chosen viewing angle", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    const menu = customizeModelViewerAr(menuSource, menuId)!.code;
    expect(renderer).toContain("this.menuPanel.setPerspectiveRotationControl()");
    expect(renderer).toContain("rotationArcPointIntersection");
    expect(renderer).toContain("this.goalPerspectiveYaw + deltaX * 2.4");
    expect(renderer).toContain("this.goalYaw + (this.placeOnWall ? this.goalPerspectiveYaw : 0)");
    expect(renderer).toContain("this.perspectiveTapDirection * Math.PI / 12");
    expect(menu).toContain("PERSPECTIVE_ARC_ICON_SVG");
    expect(menu).toContain("PerspectiveRotationArc");
    expect(menu).toContain("new PlaneGeometry(0.24, 0.09)");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotationArc)");
    expect(menu).toContain("this.perspectiveRotationControl ? -0.16 : -0.2");
  });

  test("is limited to model-viewer AR modules and fails loudly on drift", () => {
    expect(customizeModelViewerAr("export {};", "/src/app.js")).toBeNull();
    expect(modelViewerWallControlsPlugin().enforce).toBe("pre");
    expect(() => customizeModelViewerAr("export {};", rendererId)).toThrow("Unsupported model-viewer ARRenderer");
    expect(() => customizeModelViewerAr("export {};", menuId)).toThrow("Unsupported model-viewer XRMenuPanel");
  });
});
