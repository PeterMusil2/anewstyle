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

  test("renders an Apple-style spatial gizmo with two generous tap targets", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    const menu = customizeModelViewerAr(menuSource, menuId)!.code;
    expect(renderer).toContain("this.menuPanel.setPerspectiveRotationControl()");
    expect(renderer).toContain("rotationArcPointIntersection");
    expect(renderer).toContain("this.goalYaw + (this.placeOnWall ? this.goalPerspectiveYaw : 0)");
    expect(renderer).toContain("perspectiveDirection * Math.PI / 12");
    expect(menu).toContain("ROTATION_GIZMO_ICON_SVG");
    expect(menu).toContain("SpatialRotationGizmo");
    expect(menu).toContain("new PlaneGeometry(0.28, 0.175)");
    expect(menu).toContain("new PlaneGeometry(0.19, 0.24)");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotationLeftTarget)");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotationRightTarget)");
    expect(menu).toContain("colorWrite: false");
    expect(menu).toContain("placementBoxSize.y * 0.55");
  });

  test("applies exactly one deterministic step per press and recovers missed starts", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    const menu = customizeModelViewerAr(menuSource, menuId)!.code;
    expect(renderer).toContain("!this.perspectiveStepApplied");
    expect(renderer).toContain("this.inputSource = finger.inputSource");
    expect(renderer).toContain("this.perspectiveStepApplied = true");
    expect(renderer).toContain("this.perspectiveStepApplied = false");
    expect(renderer).toContain("this.menuPanel.setRotationActive(true)");
    expect(renderer).toContain("this.menuPanel?.setRotationActive(false)");
    expect(renderer).not.toContain("perspectiveTouchStartX");
    expect(renderer).not.toContain("perspectiveMoved");
    expect(menu).toContain("setRotationActive(active)");
  });

  test("is limited to model-viewer AR modules and fails loudly on drift", () => {
    expect(customizeModelViewerAr("export {};", "/src/app.js")).toBeNull();
    expect(modelViewerWallControlsPlugin().enforce).toBe("pre");
    expect(() => customizeModelViewerAr("export {};", rendererId)).toThrow("Unsupported model-viewer ARRenderer");
    expect(() => customizeModelViewerAr("export {};", menuId)).toThrow("Unsupported model-viewer XRMenuPanel");
  });
});
