/**
 * ArmPal Arena — player animations: leg walk, weapon swap.
 * Uses simple rotation/position lerp; no full animation system required.
 */

const WALK_LEG_AMPLITUDE = 0.35;
const WALK_LEG_SPEED = 12;
const WALK_VELOCITY_THRESHOLD = 0.5;
const WEAPON_SWAP_DURATION_MS = 200;

/**
 * Update leg rotation based on horizontal velocity (walk animation).
 * @param {{ legs: [import("@babylonjs/core").Mesh, import("@babylonjs/core").Mesh] }} model - from createPlayerModel
 * @param {number} vx - velocity x
 * @param {number} vz - velocity z
 * @param {number} timeSec - elapsed time in seconds
 */
export function updateLegWalk(model, vx, vz, timeSec) {
  if (!model?.legs?.length) return;
  const [legL, legR] = model.legs;
  const magnitude = Math.sqrt(vx * vx + vz * vz);
  if (magnitude < WALK_VELOCITY_THRESHOLD) {
    legL.rotation.x += (0 - legL.rotation.x) * 0.15;
    legR.rotation.x += (0 - legR.rotation.x) * 0.15;
    return;
  }
  const angle = Math.sin(timeSec * WALK_LEG_SPEED) * WALK_LEG_AMPLITUDE;
  legL.rotation.x = angle;
  legR.rotation.x = -angle;
}

/**
 * Weapon swap: returns progress 0..1 for current frame. Call each frame until progress >= 1.
 * @param {number} startTime - Date.now() when swap started
 * @returns {{ progress: number, done: boolean, outOffset: number, inOffset: number }} outOffset = current weapon Y offset (lower = down), inOffset = incoming weapon Y offset (raise)
 */
export function getWeaponSwapProgress(startTime) {
  const elapsed = Date.now() - startTime;
  const progress = Math.min(1, elapsed / WEAPON_SWAP_DURATION_MS);
  const half = progress < 0.5;
  const t = progress < 0.5 ? progress * 2 : 1;
  const outOffset = half ? -0.15 * t : -0.15;
  const inOffset = half ? 0.15 * (1 - t) : 0.15 * (1 - (progress - 0.5) * 2);
  return {
    progress,
    done: progress >= 1,
    outOffset,
    inOffset,
  };
}

export { WEAPON_SWAP_DURATION_MS, WALK_LEG_AMPLITUDE, WALK_LEG_SPEED, WALK_VELOCITY_THRESHOLD };
