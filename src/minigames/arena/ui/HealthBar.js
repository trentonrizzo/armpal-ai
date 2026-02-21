/**
 * ArmPal Arena — floating health bar above player (billboard, faces camera).
 * createHealthBar(scene, playerMesh) → { mesh, setHealth(0..1) }
 */
import {
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

const BAR_WIDTH = 0.8;
const BAR_HEIGHT = 0.08;
const BAR_OFFSET_Y = 1.55;
const BAR_DISTANCE_SCALE = 0.015;

/**
 * @param {Scene} scene
 * @param {import("@babylonjs/core").AbstractMesh} playerMesh - root or torso (position used)
 * @param {string} [name="healthBar"]
 * @returns {{ mesh: import("@babylonjs/core").Mesh, setHealth: (percent: number) => void, dispose: () => void }}
 */
export function createHealthBar(scene, playerMesh, name = "healthBar") {
  const plane = MeshBuilder.CreatePlane(name, { size: 1, sideOrientation: 2 }, scene);
  plane.billboardMode = 7;
  plane.isPickable = false;
  plane.parent = playerMesh;
  plane.position.y = BAR_OFFSET_Y;
  plane.scaling.x = BAR_WIDTH;
  plane.scaling.y = BAR_HEIGHT;

  const bgMat = new StandardMaterial(name + "Bg", scene);
  bgMat.diffuseColor = new Color3(0.15, 0.15, 0.15);
  bgMat.backFaceCulling = false;
  plane.material = bgMat;

  const fillPlane = MeshBuilder.CreatePlane(name + "Fill", { size: 1, sideOrientation: 2 }, scene);
  fillPlane.billboardMode = 7;
  fillPlane.isPickable = false;
  fillPlane.parent = plane;
  fillPlane.position.z = -0.01;
  fillPlane.scaling.x = 1;
  fillPlane.scaling.y = 1;

  const fillMat = new StandardMaterial(name + "FillMat", scene);
  fillMat.diffuseColor = new Color3(0.2, 0.75, 0.25);
  fillMat.backFaceCulling = false;
  fillPlane.material = fillMat;

  let currentPercent = 1;

  function setHealth(percent) {
    currentPercent = Math.max(0, Math.min(1, percent));
    fillPlane.scaling.x = currentPercent;
    fillPlane.position.x = (1 - currentPercent) * -0.5;
    if (currentPercent > 0.3) {
      fillMat.diffuseColor = new Color3(0.2, 0.75, 0.25);
    } else {
      fillMat.diffuseColor = new Color3(0.9, 0.2, 0.2);
    }
  }

  function dispose() {
    fillPlane.dispose();
    fillMat.dispose();
    plane.dispose();
    bgMat.dispose();
  }

  return { mesh: plane, setHealth, dispose };
}

/**
 * Optional: scale bar by distance from camera so it doesn't get huge/tiny.
 * Call each frame: updateHealthBarScale(healthBarMesh, cameraPosition, playerPosition)
 */
export function updateHealthBarScale(healthBarMesh, cameraPos, playerPos) {
  if (!healthBarMesh) return;
  const dist = Vector3.Distance(cameraPos, playerPos);
  const s = Math.max(0.5, Math.min(2, dist * BAR_DISTANCE_SCALE));
  healthBarMesh.scaling.x = BAR_WIDTH * s;
  healthBarMesh.scaling.y = BAR_HEIGHT * s;
}
