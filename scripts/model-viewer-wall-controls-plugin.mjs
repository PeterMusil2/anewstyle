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
      "this.goalYaw = 0;\n        this.goalPerspectiveYaw = 0;\n        this.perspectiveStartYaw = 0;\n        this.isPerspectiveRotating = false;\n        this.perspectiveTouchStartX = 0;\n        this.perspectiveMoved = false;\n        this.perspectiveTapDirection = 0;",
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
                        scene, arScreenPoint.set(axes[0], -axes[1])) ?? 0 : 0;
                if (perspectiveDirection !== 0) {
                    this.isPerspectiveRotating = true;
                    this.perspectiveStartYaw = this.goalPerspectiveYaw;
                    this.perspectiveTouchStartX = axes[0];
                    this.perspectiveMoved = false;
                    this.perspectiveTapDirection = perspectiveDirection;
                    this.menuPanel.setRotationActive(true);
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
            this.menuPanel?.setRotationActive(false);
            this.isTranslating = false;`,
    ],
    [
      `const scale = scene.scenePivot.scale.x;
        // Robust two-finger gesture handling`,
      `const scale = scene.scenePivot.scale.x;
        if (this.placeOnWall && fingers.length === 1 &&
            !this.isPerspectiveRotating) {
            const finger = fingers[0];
            const axes = finger.inputSource.gamepad.axes;
            const perspectiveDirection = this.menuPanel?.rotationArcPointIntersection(
                scene, arScreenPoint.set(axes[0], -axes[1])) ?? 0;
            if (!this.isPerspectiveRotating && perspectiveDirection !== 0) {
                this.inputSource = finger.inputSource;
                this.isTranslating = false;
                this.isRotating = false;
                this.isPerspectiveRotating = true;
                this.perspectiveStartYaw = this.goalPerspectiveYaw;
                this.perspectiveTouchStartX = axes[0];
                this.perspectiveMoved = false;
                this.perspectiveTapDirection = perspectiveDirection;
                this.menuPanel.setRotationActive(true);
                this.menuPanel.show = true;
                return;
            }
        }
        if (this.isPerspectiveRotating && fingers.length > 0) {
            const activeFinger = fingers.find(
                finger => finger.inputSource === this.inputSource) ?? fingers[0];
            const currentX = activeFinger.inputSource.gamepad.axes[0];
            const displacement = currentX - this.perspectiveTouchStartX;
            if (Math.abs(displacement) > 0.012) {
                this.perspectiveMoved = true;
            }
            if (this.perspectiveMoved) {
                const nextYaw = this.perspectiveStartYaw + displacement * 2.4;
                this.goalPerspectiveYaw = Math.max(
                    -Math.PI * 0.42, Math.min(Math.PI * 0.42, nextYaw));
            }
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
      `const ROTATION_GIZMO_ICON_SVG = \`<svg xmlns="http://www.w3.org/2000/svg" width="256px" height="160px" viewBox="0 0 256 160" fill="none"><path d="M18 92C34 36 222 36 238 92" stroke="#e6d3a0" stroke-width="8" stroke-linecap="round" stroke-dasharray="4 12"/><path d="M238 92C216 145 40 145 18 92" stroke="#b7a370" stroke-width="10" stroke-linecap="round"/><path d="M12 68L18 92L42 87" stroke="#b7a370" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M214 87L238 92L244 68" stroke="#b7a370" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M128 30L174 54L128 79L82 54L128 30Z" stroke="#f7f3e8" stroke-width="6" stroke-linejoin="round"/><path d="M82 54V101L128 128V79M174 54V101L128 128" stroke="#f7f3e8" stroke-width="6" stroke-linejoin="round"/></svg>\`;
// Panel configuration`,
    ],
    [
      "this.isActualSize = false; // Start with normalized size",
      "this.isActualSize = false; // Start with normalized size\n        this.perspectiveRotationControl = false;",
    ],
    [
      "this.add(this.toggleButton);\n    }",
      `this.add(this.toggleButton);
        this.rotationGizmo = this.createButton('rotation-gizmo');
        this.rotationGizmo.name = 'SpatialRotationGizmo';
        this.rotationGizmo.geometry.dispose();
        this.rotationGizmo.geometry = new PlaneGeometry(0.28, 0.175);
        this.rotationGizmo.position.set(0, 0, BUTTON_CONFIG.zOffset);
        this.rotationGizmo.visible = false;
        this.add(this.rotationGizmo);
        const touchMaterialConfig = {
            transparent: true,
            opacity: 0,
            colorWrite: false,
            depthWrite: false
        };
        this.rotationLeftTarget = new Mesh(
            new PlaneGeometry(0.19, 0.24),
            new MeshBasicMaterial(touchMaterialConfig));
        this.rotationLeftTarget.name = 'SpatialRotationLeftTarget';
        this.rotationLeftTarget.position.set(-0.095, 0, BUTTON_CONFIG.zOffset + 0.001);
        this.rotationLeftTarget.visible = false;
        this.add(this.rotationLeftTarget);
        this.rotationRightTarget = new Mesh(
            new PlaneGeometry(0.19, 0.24),
            new MeshBasicMaterial(touchMaterialConfig));
        this.rotationRightTarget.name = 'SpatialRotationRightTarget';
        this.rotationRightTarget.position.set(0.095, 0, BUTTON_CONFIG.zOffset + 0.001);
        this.rotationRightTarget.visible = false;
        this.add(this.rotationRightTarget);
    }`,
    ],
    [
      "{ key: 'replay', svg: REPLAY_ICON_SVG }",
      "{ key: 'replay', svg: REPLAY_ICON_SVG },\n            { key: 'rotation-gizmo', svg: ROTATION_GIZMO_ICON_SVG }",
    ],
    [
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
      `iconKey === 'view-real-size' ? VIEW_REAL_SIZE_ICON_SVG :
                    iconKey === 'rotation-gizmo' ? ROTATION_GIZMO_ICON_SVG :
                    REPLAY_ICON_SVG, iconKey);`,
    ],
    [
      "exitButtonControllerIntersection(scene, controller) {",
      `setPerspectiveRotationControl() {
        this.perspectiveRotationControl = true;
        this.panelMesh.visible = false;
        this.exitButton.visible = false;
        this.toggleButton.visible = false;
        this.rotationGizmo.visible = true;
        this.rotationLeftTarget.visible = true;
        this.rotationRightTarget.visible = true;
    }
    rotationArcPointIntersection(scene, ndcPosition) {
        if (!this.perspectiveRotationControl) return 0;
        if (scene.hitFromPoint(ndcPosition, this.rotationLeftTarget) != null) return -1;
        if (scene.hitFromPoint(ndcPosition, this.rotationRightTarget) != null) return 1;
        return 0;
    }
    setRotationActive(active) {
        if (!this.perspectiveRotationControl) return;
        this.rotationGizmo.material.color.setHex(active ? 0xe6d3a0 : 0xffffff);
        this.rotationGizmo.material.needsUpdate = true;
    }
    exitButtonControllerIntersection(scene, controller) {`,
    ],
    [
      "const baseOffsetUp = -0.2;\n        const baseOffsetForward = 0.9;",
      "const baseOffsetUp = this.perspectiveRotationControl ? -Math.max(0.16, placementBoxSize.y * 0.55) : -0.2;\n        const baseOffsetForward = this.perspectiveRotationControl ? 0.02 : 0.9;",
    ],
    [
      "const offsetUp = baseOffsetUp * sizeScaleFactor;",
      "const offsetUp = this.perspectiveRotationControl ? baseOffsetUp : baseOffsetUp * sizeScaleFactor;",
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
