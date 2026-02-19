/**
 * FlappyArmCharacter — clearly identifiable FLEXING ARM.
 * Side-view bicep curl pose: muscular, exaggerated bicep, strong forearm.
 * No circles/blobs for main form; arm built from defined muscle shapes.
 * Hitbox unchanged (size 36). Idle: float. Tap: flex + upward rotation. Fall: downward tilt.
 */

const ARM_SIZE = 36;

/**
 * Draw the flexing arm at (x, y) with rotation in degrees.
 * Side-view: shoulder/bicep behind, forearm/fist forward — classic curl pose.
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
  const u = size / 12; // unit for proportions

  // —— Shoulder / upper bicep (anchor) ——
  ctx.beginPath();
  ctx.moveTo(-half - 2, 0);
  ctx.lineTo(-half + u * 1.5, -u * 1.2);
  ctx.lineTo(-half + u * 1.5, u * 1.2);
  ctx.closePath();
  const shoulderGrad = ctx.createRadialGradient(-half, 0, 0, -half + u, 0, u * 2);
  shoulderGrad.addColorStop(0, "#8b7355");
  shoulderGrad.addColorStop(0.5, "#6b5344");
  shoulderGrad.addColorStop(1, "#4a3c32");
  ctx.fillStyle = shoulderGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // —— Bicep (exaggerated bulge, side-view) ——
  ctx.beginPath();
  ctx.ellipse(-u * 1.2, 0, u * 2.2, u * 1.8, 0, 0, Math.PI * 2);
  const bicepGrad = ctx.createRadialGradient(-u * 1.5, -u * 0.5, 0, -u * 1.2, 0, u * 2.5);
  bicepGrad.addColorStop(0, "#d4b896");
  bicepGrad.addColorStop(0.35, "#b8956a");
  bicepGrad.addColorStop(0.65, "#8b6914");
  bicepGrad.addColorStop(1, "#5c4a32");
  ctx.fillStyle = bicepGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();
  // Bicep peak highlight (flex definition)
  ctx.beginPath();
  ctx.ellipse(-u * 1.4, -u * 0.4, u * 0.7, u * 0.9, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,236,200,0.55)";
  ctx.fill();

  // —— Elbow crease ——
  ctx.beginPath();
  ctx.ellipse(u * 0.8, 0, u * 0.5, u * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5c4a32";
  ctx.fill();

  // —— Forearm (strong definition, tapering toward wrist) ——
  ctx.beginPath();
  ctx.moveTo(u * 0.4, -u * 1.1);
  ctx.lineTo(u * 2.8, -u * 0.9);
  ctx.lineTo(u * 2.9, u * 0.5);
  ctx.lineTo(u * 0.5, u * 1.0);
  ctx.closePath();
  const forearmGrad = ctx.createLinearGradient(u * 0.5, 0, u * 2.9, 0);
  forearmGrad.addColorStop(0, "#8b6914");
  forearmGrad.addColorStop(0.4, "#b8956a");
  forearmGrad.addColorStop(0.7, "#a08050");
  forearmGrad.addColorStop(1, "#6b5344");
  ctx.fillStyle = forearmGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();
  // Forearm vein/shadow line
  ctx.beginPath();
  ctx.moveTo(u * 1.2, -u * 0.3);
  ctx.lineTo(u * 2.4, u * 0.1);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // —— Fist (closed, side profile) ——
  ctx.beginPath();
  ctx.ellipse(half - 1, 0, u * 1.1, u * 1.35, 0, 0, Math.PI * 2);
  const fistGrad = ctx.createRadialGradient(half - u, -u * 0.3, 0, half - 1, 0, u * 1.4);
  fistGrad.addColorStop(0, "#d4b896");
  fistGrad.addColorStop(0.5, "#b8956a");
  fistGrad.addColorStop(1, "#6b5344");
  ctx.fillStyle = fistGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();
  // Knuckle hint
  ctx.beginPath();
  ctx.arc(half + u * 0.2, -u * 0.2, 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fill();

  ctx.restore();
}

/**
 * Visual rotation: TAP -10°, FALL +20° (display only).
 */
export function getVisualRotation(vy, physicsRotation) {
  if (vy < 0) return -10;
  return Math.min(20, physicsRotation);
}

export { ARM_SIZE };
