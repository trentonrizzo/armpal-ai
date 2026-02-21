/**
 * ArmPal Arena — simple low-poly weapon meshes for first/third person.
 * createWeaponMesh(scene, type) → mesh (pistol | shotgun | sniper)
 */
import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

function createPistol(scene, name) {
  const root = MeshBuilder.CreateBox(name + "PistolRoot", { width: 0.08, height: 0.08, depth: 0.25 }, scene);
  root.position.set(0.12, -0.08, 0.18);
  const slide = MeshBuilder.CreateCylinder(name + "Slide", { height: 0.2, diameter: 0.06 }, scene);
  slide.rotation.x = Math.PI / 2;
  slide.parent = root;
  slide.position.z = 0.08;
  const mat = new StandardMaterial(name + "WeaponMat", scene);
  mat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  mat.specularColor = new Color3(0.1, 0.1, 0.1);
  root.material = mat;
  slide.material = mat.clone(name + "SlideMat");
  return root;
}

function createShotgun(scene, name) {
  const root = MeshBuilder.CreateBox(name + "ShotgunRoot", { width: 0.06, height: 0.06, depth: 0.4 }, scene);
  root.position.set(0.14, -0.1, 0.22);
  const barrel = MeshBuilder.CreateCylinder(name + "Barrel", { height: 0.35, diameter: 0.05 }, scene);
  barrel.rotation.x = Math.PI / 2;
  barrel.parent = root;
  barrel.position.z = 0.1;
  const stock = MeshBuilder.CreateBox(name + "Stock", { width: 0.08, height: 0.12, depth: 0.15 }, scene);
  stock.parent = root;
  stock.position.set(0, 0, -0.12);
  const mat = new StandardMaterial(name + "ShotgunMat", scene);
  mat.diffuseColor = new Color3(0.25, 0.18, 0.12);
  root.material = mat;
  barrel.material = mat.clone(name + "BarrelMat");
  stock.material = mat.clone(name + "StockMat");
  return root;
}

function createSniper(scene, name) {
  const root = MeshBuilder.CreateBox(name + "SniperRoot", { width: 0.07, height: 0.07, depth: 0.5 }, scene);
  root.position.set(0.15, -0.1, 0.28);
  const barrel = MeshBuilder.CreateCylinder(name + "Barrel", { height: 0.45, diameter: 0.04 }, scene);
  barrel.rotation.x = Math.PI / 2;
  barrel.parent = root;
  barrel.position.z = 0.15;
  const scope = MeshBuilder.CreateCylinder(name + "Scope", { height: 0.2, diameter: 0.05 }, scene);
  scope.rotation.x = Math.PI / 2;
  scope.parent = root;
  scope.position.set(0.03, 0.04, 0.1);
  const mat = new StandardMaterial(name + "SniperMat", scene);
  mat.diffuseColor = new Color3(0.15, 0.15, 0.16);
  root.material = mat;
  barrel.material = mat.clone(name + "BarrelMat");
  scope.material = mat.clone(name + "ScopeMat");
  return root;
}

/**
 * @param {Scene} scene
 * @param {string} type - "pistol" | "shotgun" | "sniper"
 * @param {string} [name="weapon"]
 * @returns {import("@babylonjs/core").TransformNode}
 */
export function createWeaponMesh(scene, type, name = "weapon") {
  switch (type) {
    case "shotgun":
      return createShotgun(scene, name);
    case "sniper":
      return createSniper(scene, name);
    case "pistol":
    default:
      return createPistol(scene, name);
  }
}
