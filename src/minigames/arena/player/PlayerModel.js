/**
 * ArmPal Arena — full player body model (Roblox/Minecraft style).
 * Hitbox matches visual; collision on root.
 * Returns { root, head, torso, arms, legs } for animation and weapon attach.
 */
import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

/**
 * @param {Scene} scene
 * @param {string} name - prefix for mesh names
 * @param {boolean} isRemote - if true, model is visible (enemy); if false, hidden for local FP
 * @returns {{ root: import("@babylonjs/core").Mesh, head: import("@babylonjs/core").Mesh, torso: import("@babylonjs/core").Mesh, arms: [import("@babylonjs/core").Mesh, import("@babylonjs/core").Mesh], legs: [import("@babylonjs/core").Mesh, import("@babylonjs/core").Mesh] }}
 */
export function createPlayerModel(scene, name, isRemote) {
  const root = MeshBuilder.CreateBox(name + "Root", { width: 0.01, height: 0.01, depth: 0.01 }, scene);
  root.isVisible = false;
  root.isPickable = false;

  const torso = MeshBuilder.CreateBox(name + "Torso", { width: 0.5, height: 0.9, depth: 0.3 }, scene);
  torso.position.y = 0.45;
  torso.parent = root;
  torso.metadata = { hitPart: "body" };

  const head = MeshBuilder.CreateBox(name + "Head", { width: 0.4, height: 0.4, depth: 0.4 }, scene);
  head.position.y = 1.15;
  head.parent = torso;
  head.metadata = { hitPart: "head" };

  const armL = MeshBuilder.CreateBox(name + "ArmL", { width: 0.15, height: 0.5, depth: 0.15 }, scene);
  armL.position.set(-0.32, 0.9, 0);
  armL.parent = torso;
  armL.metadata = { hitPart: "limb" };

  const armR = MeshBuilder.CreateBox(name + "ArmR", { width: 0.15, height: 0.5, depth: 0.15 }, scene);
  armR.position.set(0.32, 0.9, 0);
  armR.parent = torso;
  armR.metadata = { hitPart: "limb" };

  const legL = MeshBuilder.CreateBox(name + "LegL", { width: 0.2, height: 0.4, depth: 0.25 }, scene);
  legL.position.set(-0.15, 0.2, 0);
  legL.parent = torso;
  legL.metadata = { hitPart: "limb" };

  const legR = MeshBuilder.CreateBox(name + "LegR", { width: 0.2, height: 0.4, depth: 0.25 }, scene);
  legR.position.set(0.15, 0.2, 0);
  legR.parent = torso;
  legR.metadata = { hitPart: "limb" };

  const mat = new StandardMaterial(name + "Mat", scene);
  mat.diffuseColor = isRemote ? new Color3(0.5, 0.12, 0.12) : new Color3(0.4, 0.4, 0.45);
  if (isRemote) mat.emissiveColor = new Color3(0.12, 0, 0);
  torso.material = mat;
  head.material = mat.clone(name + "HeadMat");
  armL.material = mat.clone(name + "ArmLMat");
  armR.material = mat.clone(name + "ArmRMat");
  legL.material = mat.clone(name + "LegLMat");
  legR.material = mat.clone(name + "LegRMat");

  root.checkCollisions = true;
  root.ellipsoid = new Vector3(0.35, 0.9, 0.35);
  root.ellipsoidOffset = new Vector3(0, 0.9, 0);

  if (!isRemote) {
    torso.isVisible = false;
    head.isVisible = false;
    armL.isVisible = false;
    armR.isVisible = false;
    legL.isVisible = false;
    legR.isVisible = false;
  }

  return {
    root,
    head,
    torso,
    arms: [armL, armR],
    legs: [legL, legR],
  };
}

/** Resolve hit mesh to body part (head | body | limb) for damage. */
export function getHitPartFromMesh(mesh) {
  if (!mesh) return "body";
  let m = mesh;
  while (m) {
    if (m.metadata?.hitPart) return m.metadata.hitPart;
    m = m.parent;
  }
  return "body";
}
