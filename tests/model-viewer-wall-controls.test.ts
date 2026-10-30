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
    expect(renderer).toContain("this.perspectiveTapDirection * Math.PI / 12");
    expect(menu).toContain("ROTATION_GIZMO_ICON_SVG");
    expect(menu).toContain("SpatialRotationGizmo");
    expect(menu).toContain("new PlaneGeometry(0.28, 0.175)");
    expect(menu).toContain("new PlaneGeometry(0.19, 0.24)");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotationLeftTarget)");
    expect(menu).toContain("scene.hitFromPoint(ndcPosition, this.rotationRightTarget)");
    expect(menu).toContain("colorWrite: false");
    expect(menu).toContain("placementBoxSize.y * 0.55");
  });

  test("maps WebXR touch coordinates to the visible gizmo instead of a mirrored area", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    expect(renderer).toContain("arScreenPoint.set(axes[0], -axes[1])");
    expect(renderer).not.toContain("arScreenPoint.set(axes[0], axes[1])");
  });

  test("supports direct dragging, tap steps, and recovers missed starts", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    const menu = customizeModelViewerAr(menuSource, menuId)!.code;
    expect(renderer).toContain("this.perspectiveStartYaw = this.goalPerspectiveYaw");
    expect(renderer).toContain("const displacement = currentX - this.perspectiveTouchStartX");
    expect(renderer).toContain("this.perspectiveStartYaw + displacement * 2.4");
    expect(renderer).toContain("this.inputSource = finger.inputSource");
    expect(renderer).toContain("this.isPerspectiveRotating && !this.perspectiveMoved");
    expect(renderer).toContain("this.menuPanel.setRotationActive(true)");
    expect(renderer).toContain("this.menuPanel?.setRotationActive(false)");
    expect(menu).toContain("setRotationActive(active)");
  });

  test("auto-hides the gizmo for a clean system screenshot", () => {
    const renderer = customizeModelViewerAr(rendererSource, rendererId)!.code;
    expect(renderer).toContain("const AR_CONTROLS_IDLE_MS = 3000");
    expect(renderer).toContain("this.arControlsHidden = true");
    expect(renderer).toContain("this.menuPanel.show = false");
    expect(renderer).toContain("performance.now() >= this.arControlsHideAt");
    expect(renderer).toContain("this.isRevealingArControls = true");
    expect(renderer).toContain("if (this.isRevealingArControls) return");
  });

  test("is limited to model-viewer AR modules and fails loudly on drift", () => {
    expect(customizeModelViewerAr("export {};", "/src/app.js")).toBeNull();
    expect(modelViewerWallControlsPlugin().enforce).toBe("pre");
    expect(() => customizeModelViewerAr("export {};", rendererId)).toThrow("Unsupported model-viewer ARRenderer");
    expect(() => customizeModelViewerAr("export {};", menuId)).toThrow("Unsupported model-viewer XRMenuPanel");
  });
});
