/**
 * Flappy Arm — 3-layer gym parallax background.
 * Layer 1: far (0.2x), Layer 2: mid (0.5x), Layer 3: front float.
 * GPU-friendly: opaque fills, no full-screen alpha.
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - CANVAS_W
 * @param {number} h - CANVAS_H
 * @param {number} groundY
 * @param {number} totalScroll - accumulated scroll (increases each frame by scrollSpeed)
 * @param {number} scrollSpeed
 * @param {number} time - Date.now() / 1000 for subtle float
 */
export function drawGymBackground(ctx, w, h, groundY, totalScroll, scrollSpeed, time) {
  const backOffset = (totalScroll * 0.2) % (w + 200);
  const midOffset = (totalScroll * 0.5) % (w + 150);
  const floatY = Math.sin(time * 0.5) * 2;

  // Layer 1 — far: gym wall, mounted barbells (blurred = simpler shapes)
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, w, groundY);
  const wallGrad = ctx.createLinearGradient(0, 0, w, 0);
  wallGrad.addColorStop(0, "#151515");
  wallGrad.addColorStop(0.5, "#1a1a1a");
  wallGrad.addColorStop(1, "#151515");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, groundY);
  for (let i = -1; i < 3; i++) {
    const bx = -backOffset + i * (w * 0.45) + 40;
    ctx.fillStyle = "#252525";
    ctx.fillRect(bx, 30, 80, 8);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(bx + 10, 25, 12, 20);
    ctx.fillRect(bx + 58, 25, 12, 20);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Layer 2 — mid: squat racks, benches (minimal blur = sharper)
  ctx.save();
  ctx.globalAlpha = 0.7;
  for (let i = -1; i < 3; i++) {
    const mx = -midOffset + i * (w * 0.5) + 20;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(mx, groundY - 90, 8, 90);
    ctx.fillRect(mx + 44, groundY - 90, 8, 90);
    ctx.fillStyle = "#222";
    ctx.fillRect(mx, groundY - 75, 52, 6);
    ctx.fillStyle = "#333";
    ctx.fillRect(mx + 60, groundY - 120, 35, 12);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Layer 3 — front: dust particles, light rays (subtle float)
  ctx.save();
  ctx.globalAlpha = 0.15 + Math.sin(time * 0.3) * 0.05;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 8; i++) {
    const px = (i * 137 + totalScroll * 0.1) % (w + 50) - 25;
    const py = (groundY - 80 + (i * 31) % 120) + floatY;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
