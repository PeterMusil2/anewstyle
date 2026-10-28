const AR_RENDERER_MODULE = "/@google/model-viewer/lib/three-components/ARRenderer.js";
const XR_MENU_MODULE = "/@google/model-viewer/lib/three-components/XRMenuPanel.js";

function replaceRequired(code, source, replacement, moduleName) {
  if (!code.includes(source)) {
    throw new Error(`Unsupported model-viewer ${moduleName}: missing ${source.slice(0, 80)}`);
  }
  return code.replace(source, replacement);
}

function customizeArRenderer(code) {
  let transformed = code;
  const edits = [
    [
      "import { Box3, BufferGeometry, EventDispatcher, Line, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';",
      "import { Box3, BufferGeometry, EventDispatcher, Line, Matrix4, PerspectiveCamera, Quaternion, Vector2, Vector3 } from 'three';",
    ],
    [
      "const hitPosition = new Vector3();",
      "const hitPosition = new Vector3();\nconst arScreenPoint = new Vector2();",
    ],
    [
      "this.goalYaw = 0;",
      "this.goalYaw = 0;\n        this.goalPerspectiveYaw = 0;\n        this.isPerspectiveRotating = false;\n        this.lastPerspectiveX = 0;\n        this.perspectiveTouchStartX = 0;\n        this.perspectiveMoved = false;\n        this.perspectiveTapDirection = 0;",
    ],
    [
      "this.goalYaw = scene.yaw;\n        this.goalScale = 1;",
      "this.goalYaw = scene.yaw;\n        this.goalPerspectiveYaw = 0;\n        this.goalScale = 1;",
    ],
    [
      "this.goalYaw += deltaYaw;",
      "if (!this.placeOnWall) { this.goalYaw += deltaYaw; }",
    ],
    [
      "this.goalYaw += angle - this.lastAngle;",
      "if (!this.placeOnWall) { this.goalYaw += angle - this.lastAngle; }",
    ],
    [
      "const { axes } = this.inputSource.gamepad;\n                const hitPosition = box.getHit(this.presentedScene, axes[0], axes[1]);",
      `const { axes } = this.inputSource.gamepad;
                const perspectiveDirection = this.placeOnWall ?
                    this.menuPanel?.rotationArcPointIntersection(
                        scene, arScreenPoint.set(axes[0], axes[1])) ?? 0 : 0;
                if (perspectiveDirection !== 0) {
                    this.isPerspectiveRotating = true;
                    this.lastPerspectiveX = axes[0];
                    this.perspectiveTouchStartX = axes[0];
                    this.perspectiveMoved = false;
                    this.perspectiveTapDirection = perspectiveDirection;
                    this.menuPanel.show = true;
                    return;
                }
                const hitPosition = box.getHit(this.presentedScene, axes[0], axes[1]);`,
    ],
    [
      `if (this.xrMode !== XRMode.SCREEN_SPACE) {
                if (this.menuPanel) {
                    this.menuPanel.dispose();
                    this.menuPanel = null;
                }
                this.menuPanel = new XRMenuPanel();
                this.presentedScene.add(this.menuPanel);
                this.menuPanel.updatePosition(this.presentedScene.getCamera(), this.placementBox);
            }`,
      `if (this.menuPanel) {
                this.menuPanel.dispose();
            }
            this.menuPanel = new XRMenuPanel();
            if (this.xrMode === XRMode.SCREEN_SPACE && this.placeOnWall) {
                this.menuPanel.setPerspectiveRotationControl();
            }
            this.presentedScene.add(this.menuPanel);
            this.menuPanel.updatePosition(this.presentedScene.getCamera(), this.placementBox);`,
    ],
    [
      `if (this.xrMode !== XRMode.SCREEN_SPACE) {
            this.menuPanel = new XRMenuPanel();
            scene.add(this.menuPanel);
            this.menuPanel.updatePosition(scene.getCamera(), this.placementBox); // Position the menu panel
        }`,
      `this.menuPanel = new XRMenuPanel();
        if (this.xrMode === XRMode.SCREEN_SPACE && this.placeOnWall) {
            this.menuPanel.setPerspectiveRotationControl();
        }
        scene.add(this.menuPanel);
        this.menuPanel.updatePosition(scene.getCamera(), this.placementBox); // Position the menu panel`,
    ],
    [
      `quaternion.setFromAxisAngle(vector3.set(0, 1, 0), this.goalYaw);
        const angle = scene.scenePivot.quaternion.angleTo(quaternion);`,
      `quaternion.setFromAxisAngle(
            vector3.set(0, 1, 0),
            this.goalYaw + (this.placeOnWall ? this.goalPerspectiveYaw : 0));
        const angle = scene.scenePivot.quaternion.angleTo(quaternion);`,
    ],
    [
      `this.onSelectEnd = () => {
            this.isTranslating = false;`,
      `this.onSelectEnd = () => {
            if (this.isPerspectiveRotating && !this.perspectiveMoved) {
                const nextYaw = this.goalPerspectiveYaw +
                    this.perspectiveTapDirection * Math.PI / 12;
                this.goalPerspectiveYaw = Math.max(
                    -Math.PI * 0.42, Math.min(Math.PI * 0.42, nextYaw));
            }
            this.isPerspectiveRotating = false;
            this.perspectiveTapDirection = 0;
            this.isTranslating = false;`,
    ],
    [
      `const scale = scene.scenePivot.scale.x;
        // Robust two-finger gesture handling`,
      `const scale = scene.scenePivot.scale.x;
        if (this.isPerspectiveRotating && this.inputSource) {
            const currentX = this.inputSource.gamepad.axes[0];
            const deltaX = currentX - this.lastPerspectiveX;
            if (Math.abs(currentX - this.perspectiveTouchStartX) > 0.012) {
                this.perspectiveMoved = true;
            }
            if (this.perspectiveMoved) {
                const nextYaw = this.goalPerspectiveYaw + deltaX * 2.4;
                this.goalPerspectiveYaw = Math.max(
                    -Math.PI * 0.42, Math.min(Math.PI * 0.42, nextYaw));
            }
            this.lastPerspectiveX = currentX;
            return;
        }
        // Robust two-finger gesture handling`,
    ],
  ];
  for (const [source, replacement] of edits) {
    transformed = replaceRequired(transformed, source, replacement, "ARRenderer");
  }
  return transformed;
}

function customizeXrMenu(code) {
  let transformed = code;
  const edits = [
    [
      "// Panel configuration",
      `const PERSPECTIVE_ARC_ICON_SVG = \`<svg xmlns="http://www.w3.org/2000/svg" width="256px" height="96px" viewBox="0 0 256 96" fill="none"><path d="M22 70C54 20 202 20 234 70" stroke="#b7a370" stroke-width="10" stroke-linecap="round"/><path d="M13 52L22 70L42 68" stroke="#b7a370" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M214 68L234 70L243 52" stroke="#b7a370" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M102 82H154" stroke="#e8eaed" stroke-width="5" stroke-linecap="round" opacity=".9"/></svg>\`;
// Panel configuration`,
    ],
    [
      "this.isActualSize = false; // Start with normalized size",
      "this.isActualSize = false; // Start with normalized size\n        this.perspectiveRotationControl = false;",
    ],
    [
      "this.add(this.toggleButton);\n    }",
      `this.add(this.toggleButton);
        this.rotationArc = this.createButton('perspective-arc');
        this.rotationArc.name = 'PerspectiveRotationArc';
        this.rotationArc.geometry.dispose();
        this.rotationArc.geometry = new PlaneGeometry(0.24, 0.09);
        this.rotationArc.position.set(0, 0, BUTTON_CONFIG.zOffset);
        this.rotationArc.visible = false;
        this.add(this.rotationArc);
    }`,
    ],
    [
      "{ key: 'replay', svg: REPLAY_ICON_SVG }",
      "{ key: 'replay', svg: REPLAY_ICON_SVG },\n            { key: 'perspective-arc', svg: PERSPECTIVE_ARC_ICON_SVG }",
    ],
    [
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    iconKey === 'perspective-arc' ? PERSPECTIVE_ARC_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
    ],
    [
      "exitButtonControllerIntersection(scene, controller) {",
      `setPerspectiveRotationControl() {
        this.perspectiveRotationControl = true;
        this.panelMesh.visible = false;
        this.exitButton.visible = false;
        this.toggleButton.visible = false;
        this.rotationArc.visible = true;
    }
    rotationArcPointIntersection(scene, ndcPosition) {
        if (!this.perspectiveRotationControl ||
            scene.hitFromPoint(ndcPosition, this.rotationArc) == null) return 0;
        const arcCenter = new Vector3();
        this.rotationArc.getWorldPosition(arcCenter);
        arcCenter.project(scene.getCamera());
        return ndcPosition.x < arcCenter.x ? -1 : 1;
    }
    exitButtonControllerIntersection(scene, controller) {`,
    ],
    [
      "const baseOffsetUp = -0.2;\n        const baseOffsetForward = 0.9;",
      "const baseOffsetUp = this.perspectiveRotationControl ? -0.16 : -0.2;\n        const baseOffsetForward = this.perspectiveRotationControl ? 0.02 : 0.9;",
    ],
  ];
  for (const [source, replacement] of edits) {
    transformed = replaceRequired(transformed, source, replacement, "XRMenuPanel");
  }
  return transformed;
}

export function customizeModelViewerAr(code, id) {
  const normalizedId = id.replaceAll("\\", "/");
  if (normalizedId.endsWith(AR_RENDERER_MODULE)) {
    return { code: customizeArRenderer(code), map: null };
  }
  if (normalizedId.endsWith(XR_MENU_MODULE)) {
    return { code: customizeXrMenu(code), map: null };
  }
  return null;
}

/** Samsung Internet needs Three.js controls because it omits DOM overlays. */
export function modelViewerWallControlsPlugin() {
  return {
    name: "anewstyle-model-viewer-wall-controls",
    enforce: "pre",
    transform: customizeModelViewerAr,
  };
}
