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
      "const hitPosition = new Vector3();\nconst arScreenPoint = new Vector2();\nconst arRollAxis = new Vector3(0, 0, 1);\nconst arRollQuaternion = new Quaternion();",
    ],
    ["this.goalYaw = 0;", "this.goalYaw = 0;\n        this.goalRoll = 0;"],
    [
      "this.goalYaw = scene.yaw;\n        this.goalScale = 1;",
      "this.goalYaw = scene.yaw;\n        this.goalRoll = 0;\n        this.goalScale = 1;",
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
                const rotationDirection = this.placeOnWall ?
                    this.menuPanel?.rotationButtonPointIntersection(
                        scene, arScreenPoint.set(axes[0], axes[1])) ?? 0 : 0;
                if (rotationDirection !== 0) {
                    this.goalRoll += rotationDirection * Math.PI / 2;
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
                this.menuPanel.setRotationOnly();
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
            this.menuPanel.setRotationOnly();
        }
        scene.add(this.menuPanel);
        this.menuPanel.updatePosition(scene.getCamera(), this.placementBox); // Position the menu panel`,
    ],
    [
      `quaternion.setFromAxisAngle(vector3.set(0, 1, 0), this.goalYaw);
        const angle = scene.scenePivot.quaternion.angleTo(quaternion);`,
      `quaternion.setFromAxisAngle(vector3.set(0, 1, 0), this.goalYaw);
        if (this.placeOnWall) {
            arRollQuaternion.setFromAxisAngle(arRollAxis, this.goalRoll);
            quaternion.multiply(arRollQuaternion);
        }
        const angle = scene.scenePivot.quaternion.angleTo(quaternion);`,
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
      `const ROTATE_LEFT_ICON_SVG = \`<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="#e8eaed"><path d="M7.1 6.3A8 8 0 1 1 4 12H2a10 10 0 1 0 3.5-7.6L2 1v7h7L7.1 6.3Z"/></svg>\`;
const ROTATE_RIGHT_ICON_SVG = \`<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="#e8eaed"><path d="M16.9 6.3A8 8 0 1 0 20 12h2a10 10 0 1 1-3.5-7.6L22 1v7h-7l1.9-1.7Z"/></svg>\`;
// Panel configuration`,
    ],
    [
      "this.isActualSize = false; // Start with normalized size",
      "this.isActualSize = false; // Start with normalized size\n        this.rotationOnly = false;",
    ],
    [
      "this.add(this.toggleButton);\n    }",
      `this.add(this.toggleButton);
        this.rotateLeftButton = this.createButton('rotate-left');
        this.rotateLeftButton.name = 'RotateLeftButton';
        this.rotateLeftButton.position.set(-BUTTON_CONFIG.spacing / 2, 0, BUTTON_CONFIG.zOffset);
        this.rotateLeftButton.visible = false;
        this.add(this.rotateLeftButton);
        this.rotateRightButton = this.createButton('rotate-right');
        this.rotateRightButton.name = 'RotateRightButton';
        this.rotateRightButton.position.set(BUTTON_CONFIG.spacing / 2, 0, BUTTON_CONFIG.zOffset);
        this.rotateRightButton.visible = false;
        this.add(this.rotateRightButton);
    }`,
    ],
    [
      "{ key: 'replay', svg: REPLAY_ICON_SVG }",
      "{ key: 'replay', svg: REPLAY_ICON_SVG },\n            { key: 'rotate-left', svg: ROTATE_LEFT_ICON_SVG },\n            { key: 'rotate-right', svg: ROTATE_RIGHT_ICON_SVG }",
    ],
    [
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    iconKey === 'rotate-left' ? ROTATE_LEFT_ICON_SVG :
                    iconKey === 'rotate-right' ? ROTATE_RIGHT_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
    ],
    [
      "exitButtonControllerIntersection(scene, controller) {",
      `setRotationOnly() {
        this.rotationOnly = true;
        this.exitButton.visible = false;
        this.toggleButton.visible = false;
        this.rotateLeftButton.visible = true;
        this.rotateRightButton.visible = true;
        this.rotateLeftButton.scale.setScalar(1.35);
        this.rotateRightButton.scale.setScalar(1.35);
    }
    rotationButtonPointIntersection(scene, ndcPosition) {
        if (!this.rotationOnly) return 0;
        if (scene.hitFromPoint(ndcPosition, this.rotateLeftButton) != null) return -1;
        if (scene.hitFromPoint(ndcPosition, this.rotateRightButton) != null) return 1;
        return 0;
    }
    exitButtonControllerIntersection(scene, controller) {`,
    ],
    [
      "const baseOffsetUp = -0.2;\n        const baseOffsetForward = 0.9;",
      "const baseOffsetUp = this.rotationOnly ? -0.16 : -0.2;\n        const baseOffsetForward = this.rotationOnly ? 0.02 : 0.9;",
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
