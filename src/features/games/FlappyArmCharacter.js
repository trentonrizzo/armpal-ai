/**
 * FlappyArmCharacter — canvas draw for stylized muscular arm.
 * Same hitbox as original (size 36). Animation: idle hover, tap -10°, fall +20° (visual only).
 * Johnny Bravo style exaggerated muscle; bicep + forearm separation.
 */

const ARM_SIZE = 36;

/**
 * Draw the muscular arm at (x, y) with rotation in degrees.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - center x
 * @param {number} y - center y
 * @param {number} rotation - degrees (tap: -10, fall: +20)
 * @param {object} opts - { size, hoverY } hoverY = subtle vertical offset for idle
 */
export function drawFlappyArmCharacter(ctx, x, y, rotation, opts = {}) {
  const size = opts.size ?? ARM_SIZE;
  const hoverY = opts.hoverY ?? 0;
  const drawX = x;
  const drawY = y + hoverY;

  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.rotate((rotation * Math.PI) / 180);

  const half = size / 2;
  const r = half * 0.9;

  // Shadow base (drawn under arm in main loop; here we only draw arm)
  // Arm: stylized bicep + forearm, fist. Right arm pointing right (0°), up = negative rotation.

  // Bicep — rounded capsule, exaggerated bulge
  const bicepW = half * 1.1;
  const bicepH = half * 0.85;
  ctx.beginPath();
  ctx.ellipse(-half * 0.5, 0, bicepW * 0.5, bicepH, 0, 0, Math.PI * 2);
  const bicepGrad = ctx.createRadialGradient(
    -half * 0.6, 0, 0,
    -half * 0.5, 0, bicepW
  );
  bicepGrad.addColorStop(0, "#c4a574");
  bicepGrad.addColorStop(0.4, "#a08050");
  bicepGrad.addColorStop(0.7, "#6b5344");
  bicepGrad.addColorStop(1, "#4a3c32");
  ctx.fillStyle = bicepGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bicep highlight (muscle definition)
  ctx.beginPath();
  ctx.ellipse(-half * 0.55, -half * 0.15, bicepW * 0.2, bicepH * 0.35, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,230,200,0.5)";
  ctx.fill();

  // Forearm — elongated, slightly narrower
  const forearmW = half * 0.5;
  const forearmH = half * 1.0;
  ctx.beginPath();
  ctx.ellipse(half * 0.35, 0, forearmW, forearmH, 0, 0, Math.PI * 2);
  const forearmGrad = ctx.createRadialGradient(
    half * 0.2, 0, 0,
    half * 0.35, 0, forearmW
  );
  forearmGrad.addColorStop(0, "#b8956a");
  forearmGrad.addColorStop(0.5, "#8b6914");
  forearmGrad.addColorStop(1, "#5c4a32");
  ctx.fillStyle = forearmGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();

  // Fist / hand at end
  const fistR = half * 0.4;
  ctx.beginPath();
  ctx.arc(half * 0.9, 0, fistR, 0, Math.PI * 2);
  const fistGrad = ctx.createRadialGradient(
    half * 0.85, -2, 0,
    half * 0.9, 0, fistR
  );
  fistGrad.addColorStop(0, "#d4b896");
  fistGrad.addColorStop(0.6, "#a08050");
  fistGrad.addColorStop(1, "#6b5344");
  ctx.fillStyle = fistGrad;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Compute visual rotation from physics: TAP -10°, FALL +20° (spec).
 * Physics rotation is unchanged; this is for display only.
 */
export function getVisualRotation(vy, physicsRotation) {
  if (vy < 0) return -10; // tap / jump
  return Math.min(20, physicsRotation);
}

export { ARM_SIZE };
